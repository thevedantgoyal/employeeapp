import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { RoomBooking, MeetingRoom } from "@/hooks/useRoomBooking";

const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = i % 2 === 0 ? "00" : "30";
  if (h > 19) return null;
  return `${String(h).padStart(2, "0")}:${m}`;
}).filter(Boolean) as string[];

/** Normalize "HH:MM:SS" or "HH:MM" to "HH:MM" for slot select. */
function toTimeSlot(t: string): string {
  if (!t) return "";
  const part = t.slice(0, 5);
  return TIME_SLOTS.includes(part) ? part : part;
}

interface RescheduleModalProps {
  open: boolean;
  booking: RoomBooking | null;
  rooms: MeetingRoom[];
  onConfirm: (bookingId: string, payload: { room_id: string; booking_date: string; start_time: string; end_time: string }) => Promise<void>;
  onClose: () => void;
}

export function RescheduleModal({ open, booking, rooms, onConfirm, onClose }: RescheduleModalProps) {
  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState<Date>();
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!booking) return;
    setRoomId(booking.room_id);
    setDate(booking.booking_date ? new Date(booking.booking_date + "T12:00:00") : undefined);
    setStartTime(toTimeSlot(booking.start_time));
    setEndTime(toTimeSlot(booking.end_time));
    setError(null);
  }, [booking]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isToday = date && date.getTime() === today.getTime();
  const now = new Date();
  const filteredStartSlots = isToday
    ? TIME_SLOTS.filter((slot) => {
        const [h, m] = slot.split(":").map(Number);
        const slotDate = new Date(date!);
        slotDate.setHours(h, m, 0, 0);
        return slotDate > now;
      })
    : TIME_SLOTS;

  const startMins = startTime ? (() => { const [h, m] = startTime.split(":").map(Number); return h * 60 + m; })() : 0;
  const filteredEndSlots = TIME_SLOTS.filter((slot) => {
    const [h, m] = slot.split(":").map(Number);
    return h * 60 + m > startMins;
  });

  useEffect(() => {
    if (!endTime || startMins <= 0) return;
    const [eh, em] = endTime.split(":").map(Number);
    if (eh * 60 + em <= startMins && filteredEndSlots[0]) setEndTime(filteredEndSlots[0]);
  }, [startTime]);

  const handleSubmit = async () => {
    if (!booking || !roomId || !date || !startTime || !endTime) return;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    if (eh * 60 + em <= sh * 60 + sm) {
      setError("End time must be after start time.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(booking.id, {
        room_id: roomId,
        booking_date: format(date, "yyyy-MM-dd"),
        start_time: startTime + ":00",
        end_time: endTime + ":00",
      });
      onClose();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Room not available at selected time. Please choose another room or time.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const activeRooms = rooms.filter((r) => r.status === "active");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Reschedule Meeting</DialogTitle>
          {booking && <p className="text-sm text-muted-foreground">{booking.title}</p>}
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <Label>Room</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
              <SelectContent>
                {activeRooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name} — {r.location}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d < today}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Time</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger><SelectValue placeholder="Start" /></SelectTrigger>
                <SelectContent>
                  {filteredStartSlots.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>End Time</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger><SelectValue placeholder="End" /></SelectTrigger>
                <SelectContent>
                  {filteredEndSlots.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !roomId || !date || !startTime || !endTime}>
              {submitting ? "Rescheduling..." : "Confirm Reschedule"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
