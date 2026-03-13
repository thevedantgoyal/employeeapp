import { useState, useMemo, useEffect } from "react";
import { format, addDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MeetingRoom, RoomBooking } from "@/hooks/useRoomBooking";

interface RoomAvailabilityProps {
  rooms: MeetingRoom[];
  bookings: RoomBooking[];
  onDateChange: (date: string) => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8);

/** Normalize time to HH:MM:00 for consistent comparison. Handles "HH:MM", "HH:MM:SS", ISO datetime, or Date. */
function normalizeTime(t: string | Date | undefined | null): string {
  if (t == null) return "00:00:00";
  if (typeof t === "object" && "getHours" in t) {
    const d = t as Date;
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
  }
  const s = String(t).trim();
  if (!s) return "00:00:00";
  const isoMatch = s.match(/T(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[-+]\d{2}:?\d{2})?$/i);
  if (isoMatch) {
    return `${isoMatch[1].padStart(2, "0")}:${isoMatch[2].padStart(2, "0")}:00`;
  }
  const parts = s.split(":");
  const h = parts[0]?.replace(/\D/g, "").padStart(2, "0") ?? "00";
  const m = (parts[1] ?? "00").replace(/\D/g, "").padStart(2, "0");
  return `${h}:${m}:00`;
}

/** Read priority from booking; API may return lowercase "priority" or other casing. */
function getBookingPriority(b: RoomBooking): string {
  const o = b as unknown as Record<string, unknown>;
  const v = o.priority ?? o.Priority ?? b.priority;
  return String(v ?? "normal").trim().toLowerCase() || "normal";
}

/** Priority order for conflict resolution: higher number = higher priority. */
const PRIORITY_ORDER: Record<string, number> = { normal: 0, high: 1, leadership: 2 };

function getPriorityLevel(priority: string | undefined | null): number {
  return PRIORITY_ORDER[String(priority ?? "normal").toLowerCase()] ?? 0;
}

/** Map priority to Tailwind cell background class. Normalize key to lowercase so API casing does not break UI. */
function getPriorityColorClass(priority: string | undefined | null): string {
  const key = String(priority ?? "normal").toLowerCase();
  const map: Record<string, string> = {
    normal: "bg-primary/70",
    high: "bg-amber-500",
    leadership: "bg-destructive",
  };
  return map[key] ?? map.normal;
}

export const RoomAvailability = ({ rooms, bookings, onDateChange }: RoomAvailabilityProps) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedRoom, setSelectedRoom] = useState<string>("all");
  const activeRooms = rooms.filter(r => String(r?.status ?? "").toLowerCase() === "active");

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  console.log("[RoomGrid] Render - bookings prop length:", bookings.length, "| selectedDate:", format(selectedDate, "yyyy-MM-dd"));

  // When grid mounts or displayed date changes, fetch bookings for that date so the grid has correct data
  useEffect(() => {
    console.log("[RoomGrid] API request triggered with booking_date:", dateStr);
    onDateChange(dateStr);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally run when dateStr changes
  }, [dateStr]);

  const dayBookings = useMemo(() => {
    const filtered = bookings.filter(b => {
      const ob = b as unknown as Record<string, unknown>;
      const status = String(ob.status ?? b.status ?? "").toLowerCase();
      if (status === "cancelled") return false;
      const raw = ob.booking_date ?? b.booking_date;
      let bDate = "";
      if (typeof raw === "string") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          bDate = raw;
        } else {
          bDate = format(new Date(raw), "yyyy-MM-dd");
        }
      } else if (raw && typeof raw === "object" && "getFullYear" in raw) {
        bDate = format(raw as Date, "yyyy-MM-dd");
      }
      return bDate === dateStr;
    });
    console.log("[RoomGrid] dayBookings for", dateStr, "| bookings.length:", bookings.length, "| dayBookings.length:", filtered.length);
    return filtered;
  }, [bookings, dateStr]);

  /** Precompute (roomId, hour) -> booking for O(1) lookup. On overlap, keep higher-priority booking. */
  const slotToBooking = useMemo(() => {
    const map = new Map<string, RoomBooking>();
    for (const b of dayBookings) {
      const ob = b as unknown as Record<string, unknown>;
      const startRaw = ob.start_time ?? b.start_time;
      const endRaw = ob.end_time ?? b.end_time;
      const startNorm = normalizeTime(startRaw as string);
      const endNorm = normalizeTime(endRaw as string);
      const roomId = String(ob.room_id ?? b.room_id ?? "");
      for (const hour of HOURS) {
        const slotStart = `${String(hour).padStart(2, "0")}:00:00`;
        const slotEnd = `${String(hour + 1).padStart(2, "0")}:00:00`;
        const overlaps = startNorm < slotEnd && endNorm > slotStart;
        if (!overlaps) continue;
        const key = `${roomId}|${hour}`;
        const existing = map.get(key);
        if (!existing || getPriorityLevel(getBookingPriority(b)) > getPriorityLevel(getBookingPriority(existing))) {
          map.set(key, b);
        }
      }
    }
    return map;
  }, [dayBookings]);

  const getSlotStatus = (roomId: string, hour: number): RoomBooking | null => {
    return slotToBooking.get(`${roomId}|${hour}`) ?? null;
  };

  const navigate = (dir: number) => {
    setSelectedDate((prev) => addDays(prev, dir));
    // useEffect will call onDateChange when dateStr updates
  };

  const filteredRooms = selectedRoom === "all" ? activeRooms : activeRooms.filter(r => r.id === selectedRoom);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-display">Room Availability</CardTitle>
          <Select value={selectedRoom} onValueChange={setSelectedRoom}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All rooms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rooms</SelectItem>
              {activeRooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between mt-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium">{format(selectedDate, "EEEE, MMM d, yyyy")}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-[500px]">
          {/* Time header */}
          <div className="flex border-b border-border pb-1 mb-2">
            <div className="w-24 shrink-0 text-[10px] text-muted-foreground font-medium">Room</div>
            {HOURS.map(h => (
              <div key={h} className="flex-1 text-[10px] text-muted-foreground text-center">{h}:00</div>
            ))}
          </div>

          {filteredRooms.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">No rooms available.</p>
          ) : (
            filteredRooms.map(room => (
              <div key={room.id} className="flex items-center mb-1.5">
                <div className="w-24 shrink-0 text-xs font-medium truncate pr-2">{room.name}</div>
                <div className="flex-1 flex gap-px">
                  {HOURS.map(h => {
                    const booking = getSlotStatus(room.id, h);
                    const priority = booking ? getBookingPriority(booking) : "";
                    const colorClass = booking ? getPriorityColorClass(priority) : "";
                    return (
                      <div
                        key={h}
                        className={`flex-1 h-7 rounded-sm transition-colors ${
                          booking
                            ? `${colorClass} cursor-pointer`
                            : "bg-muted/50 hover:bg-muted"
                        }`}
                        title={booking ? `${(booking as unknown as Record<string, unknown>).title ?? booking.title} (${priority})` : `Available ${h}:00-${h + 1}:00`}
                      />
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {/* Legend */}
          <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border">
            <span className="text-[10px] text-muted-foreground">Legend:</span>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-muted/50" /><span className="text-[10px]">Available</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-primary/70" /><span className="text-[10px]">Normal</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-amber-500" /><span className="text-[10px]">High</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-destructive" /><span className="text-[10px]">Leadership</span></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
