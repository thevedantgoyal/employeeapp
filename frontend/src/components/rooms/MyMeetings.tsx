import { useMemo, useState } from "react";
import { format, parseISO, isPast } from "date-fns";
import { Clock, MapPin, Users, XCircle, CalendarClock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RescheduleModal } from "@/components/rooms/RescheduleModal";
import { ScrollablePillRow } from "@/components/ui/scrollable-pill-row";
import type { RoomBooking, MeetingRoom } from "@/hooks/useRoomBooking";

type MyFilter = "all" | "today" | "upcoming" | "expired" | "cancelled";

interface MyMeetingsProps {
  bookings: RoomBooking[];
  rooms: MeetingRoom[];
  onCancel: (id: string, reason: string) => Promise<void>;
  onReschedule: (id: string, payload: { room_id: string; booking_date: string; start_time: string; end_time: string }) => Promise<void>;
}

const statusStyles: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary",
  ongoing: "bg-success/10 text-success",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  rescheduled: "bg-amber-100 text-amber-700",
  expired: "bg-muted text-muted-foreground",
};

/** Local date (midnight) for comparison. */
function toLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getTodayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isBookingToday(b: RoomBooking): boolean {
  const today = getTodayLocal();
  const bookingDate = toLocalDate(b.booking_date);
  return bookingDate.getTime() === today.getTime();
}

function isBookingPastDate(b: RoomBooking): boolean {
  const today = getTodayLocal();
  const bookingDate = toLocalDate(b.booking_date);
  return bookingDate.getTime() < today.getTime();
}

function isBookingFutureDate(b: RoomBooking): boolean {
  const today = getTodayLocal();
  const bookingDate = toLocalDate(b.booking_date);
  return bookingDate.getTime() > today.getTime();
}

/** Meeting has already started (current time >= start). */
function hasMeetingStarted(b: RoomBooking): boolean {
  const startAt = new Date(`${b.booking_date}T${b.start_time}`);
  return isPast(startAt);
}

/** Cancel booking dialog with local reason state so typing does not re-render parent. */
function CancelBookingDialog({
  open,
  bookingId,
  onClose,
  onConfirm,
}: {
  open: boolean;
  bookingId: string | null;
  onClose: () => void;
  onConfirm: (id: string, reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");

  const handleClose = () => {
    setReason("");
    onClose();
  };

  const handleConfirm = async () => {
    if (!bookingId || !reason.trim()) return;
    await onConfirm(bookingId, reason.trim());
    setReason("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Cancel Booking</DialogTitle></DialogHeader>
        <Textarea placeholder="Reason for cancellation..." value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        <Button variant="destructive" onClick={handleConfirm} disabled={!reason.trim()}>Confirm Cancellation</Button>
      </DialogContent>
    </Dialog>
  );
}

export const MyMeetings = ({ bookings, rooms, onCancel, onReschedule }: MyMeetingsProps) => {
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [filter, setFilter] = useState<MyFilter>("all");

  const roomMap = useMemo(() => Object.fromEntries(rooms.map(r => [r.id, r])), [rooms]);

  const todaysMeetings = useMemo(() =>
    bookings.filter(b => b.status === "scheduled" && isBookingToday(b)),
    [bookings]
  );

  const upcomingMeetings = useMemo(() =>
    bookings.filter(b => b.status === "scheduled" && isBookingFutureDate(b)).slice(0, 20),
    [bookings]
  );

  const expiredMeetings = useMemo(() =>
    bookings.filter(b => b.status === "scheduled" && isBookingPastDate(b)),
    [bookings]
  );

  const recentHistory = useMemo(() =>
    bookings.filter(b => b.status === "cancelled").slice(0, 10),
    [bookings]
  );

  const counts = useMemo(() => ({
    all: bookings.length,
    today: todaysMeetings.length,
    upcoming: upcomingMeetings.length,
    expired: expiredMeetings.length,
    cancelled: recentHistory.length,
  }), [bookings.length, todaysMeetings.length, upcomingMeetings.length, expiredMeetings.length, recentHistory.length]);

  const showAll = filter === "all";
  const showToday = showAll || filter === "today";
  const showUpcoming = showAll || filter === "upcoming";
  const showExpired = showAll || filter === "expired";
  const showHistory = showAll || filter === "cancelled";

  const handleCancelConfirm = async (id: string, reason: string) => {
    await onCancel(id, reason);
    setCancelId(null);
  };

  const handleRescheduleConfirm = async (
    bookingId: string,
    payload: { room_id: string; booking_date: string; start_time: string; end_time: string }
  ) => {
    await onReschedule(bookingId, payload);
    setRescheduleId(null);
  };

  const rescheduleBooking = useMemo(() => bookings.find(b => b.id === rescheduleId) ?? null, [bookings, rescheduleId]);

  type CardVariant = "today" | "upcoming" | "expired" | "history";
  const BookingCard = ({ b, variant }: { b: RoomBooking; variant: CardVariant }) => {
    const room = roomMap[b.room_id];
    const isToday = variant === "today";
    const started = isToday && hasMeetingStarted(b);
    const showActions = (variant === "today" && !started) || variant === "upcoming";
    const displayStatus =
      variant === "expired" ? "expired" :
      variant === "history" ? "cancelled" :
      isToday && started ? "passed" : b.status;

    return (
      <Card className={variant === "expired" ? "card-hover opacity-75 bg-muted/30" : "card-hover"}>
        <CardContent className="p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm truncate">{b.title}</h4>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3 shrink-0" />
                <span>{format(parseISO(b.booking_date), "MMM d")} · {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}</span>
              </div>
              {room && (
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span>{room.name} — {room.location}</span>
                </div>
              )}
              {b.participants && b.participants.length > 0 && (
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                  <Users className="w-3 h-3 shrink-0" />
                  <span>{b.participants.length} participant{b.participants.length > 1 ? "s" : ""}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5 ml-2">
              <Badge className={`text-[10px] ${statusStyles[displayStatus] || ""}`}>
                {displayStatus === "passed" ? "Passed" : displayStatus === "expired" ? "Expired" : b.status}
              </Badge>
              <Badge variant="outline" className="text-[10px]">{b.priority}</Badge>
            </div>
          </div>
          {showActions && (
            <div className="mt-2 pt-2 border-t border-border flex gap-2">
              <Button variant="ghost" size="sm" className="text-destructive h-7 text-xs gap-1" onClick={() => setCancelId(b.id)}>
                <XCircle className="w-3 h-3" /> Cancel Booking
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setRescheduleId(b.id)}>
                <CalendarClock className="w-3 h-3" /> Reschedule
              </Button>
            </div>
          )}
          {isToday && started && (
            <p className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground">In Progress / Passed</p>
          )}
        </CardContent>
      </Card>
    );
  };

  const pills: { value: MyFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "today", label: "Today", count: counts.today },
    { value: "upcoming", label: "Upcoming", count: counts.upcoming },
    { value: "expired", label: "Expired", count: counts.expired },
    { value: "cancelled", label: "Cancelled", count: counts.cancelled },
  ];

  return (
    <div className="space-y-4">
      {/* Filter pills — Option C: horizontal scroll with fade edges */}
      <div className="pb-1">
        <ScrollablePillRow>
          {pills.map(({ value: v, label, count }) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilter(v)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === v
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </ScrollablePillRow>
      </div>

      {/* 1. Today's Meetings */}
      {(showToday || filter === "today") && (
        <div>
          <h2 className="text-base font-display font-semibold mb-2">Today&apos;s Meetings</h2>
          {todaysMeetings.length === 0 ? (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No meetings scheduled for today.</CardContent></Card>
          ) : (
            <div className="space-y-2">{todaysMeetings.map(b => <BookingCard key={b.id} b={b} variant="today" />)}</div>
          )}
        </div>
      )}

      {/* 2. Upcoming Meetings */}
      {(showUpcoming || filter === "upcoming") && (
        <div>
          <h2 className="text-base font-display font-semibold mb-2">Upcoming Meetings</h2>
          {upcomingMeetings.length === 0 ? (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No upcoming meetings.</CardContent></Card>
          ) : (
            <div className="space-y-2">{upcomingMeetings.map(b => <BookingCard key={b.id} b={b} variant="upcoming" />)}</div>
          )}
        </div>
      )}

      {/* 3. Expired Meetings — hide section if empty when "all", or when filter is expired show section even if 0 */}
      {(showExpired && expiredMeetings.length > 0) || filter === "expired" ? (
        <div>
          <h2 className="text-base font-display font-semibold mb-2">Expired Meetings</h2>
          {expiredMeetings.length === 0 ? (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No expired meetings.</CardContent></Card>
          ) : (
            <div className="space-y-2">{expiredMeetings.map(b => <BookingCard key={b.id} b={b} variant="expired" />)}</div>
          )}
        </div>
      ) : null}

      {/* 4. Recent History / Cancelled Meetings */}
      {(showHistory || filter === "cancelled") && (
        <div>
          <h2 className="text-base font-display font-semibold mb-2">{filter === "cancelled" ? "Cancelled Meetings" : "Recent History"}</h2>
          {recentHistory.length === 0 ? (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No cancelled meetings.</CardContent></Card>
          ) : (
            <div className="space-y-2">{recentHistory.map(b => <BookingCard key={b.id} b={b} variant="history" />)}</div>
          )}
        </div>
      )}

      <CancelBookingDialog
        open={cancelId !== null}
        bookingId={cancelId}
        onClose={() => setCancelId(null)}
        onConfirm={handleCancelConfirm}
      />

      <RescheduleModal
        open={rescheduleId !== null}
        booking={rescheduleBooking}
        rooms={rooms}
        onConfirm={handleRescheduleConfirm}
        onClose={() => setRescheduleId(null)}
      />
    </div>
  );
}
