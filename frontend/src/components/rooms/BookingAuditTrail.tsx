import { useState } from "react";
import { format, parseISO, isPast } from "date-fns";
import { FileText, Clock, Shield, User, MapPin, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RoomBooking, AuditLogEntry, MeetingRoom } from "@/hooks/useRoomBooking";

interface BookingAuditTrailProps {
  bookings: RoomBooking[];
  rooms: MeetingRoom[];
  fetchAuditLog: (bookingId: string) => Promise<AuditLogEntry[] | null>;
  fetchInvitedBookings?: () => Promise<void>;
}

function isBookingExpired(b: RoomBooking): boolean {
  const endAt = new Date(`${b.booking_date}T${b.end_time}`);
  return isPast(endAt);
}

const actionColors: Record<string, string> = {
  created: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  updated: "bg-amber-100 text-amber-700",
  priority_changed: "bg-primary/10 text-primary",
};

export const BookingAuditTrail = ({ bookings, rooms, fetchAuditLog, fetchInvitedBookings }: BookingAuditTrailProps) => {
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const roomMap = Object.fromEntries(rooms.map(r => [r.id, r]));

  const handleSelect = async (bookingId: string) => {
    if (selectedBooking === bookingId) {
      setSelectedBooking(null);
      return;
    }
    setSelectedBooking(bookingId);
    setLoading(true);
    const entries = await fetchAuditLog(bookingId);
    setAuditEntries(entries || []);
    setLoading(false);
  };

  const recentBookings = bookings.slice(0, 50);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary" />
        <h2 className="text-base font-display font-semibold">Meetings I'm Invited To</h2>
      </div>

      <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
        <FileText className="w-3 h-3" />
        Meetings where you are included as a participant.
      </p>

      {recentBookings.length === 0 ? (
        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No meetings found.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {recentBookings.map(b => {
            const room = roomMap[b.room_id];
            const expired = isBookingExpired(b);
            const statusLabel = b.status === "cancelled" ? "Cancelled" : expired ? "Expired" : "Active";
            const statusClass = b.status === "cancelled" ? "bg-destructive/10 text-destructive" : expired ? "bg-muted text-muted-foreground" : "bg-success/10 text-success";
            return (
              <Card key={b.id} className="cursor-pointer card-hover" onClick={() => handleSelect(b.id)}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium">{b.title}</h4>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>{room?.name ?? "—"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                        <User className="w-3 h-3 shrink-0" />
                        <span>Booked by: {b.booked_by_name ?? "—"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>{format(parseISO(b.booking_date), "MMM d, yyyy")} · {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}</span>
                      </div>
                      {b.participants && b.participants.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                          <Users className="w-3 h-3 shrink-0" />
                          <span>{b.participants.length} participant{b.participants.length !== 1 ? "s" : ""}</span>
                        </div>
                      )}
                    </div>
                    <Badge className={`text-[10px] shrink-0 ${statusClass}`}>{statusLabel}</Badge>
                  </div>

                  {selectedBooking === b.id && (
                    <div className="mt-3 pt-3 border-t border-border">
                      {loading ? (
                        <p className="text-xs text-muted-foreground">Loading timeline...</p>
                      ) : auditEntries.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No audit entries recorded.</p>
                      ) : (
                        <div className="relative pl-4 space-y-2">
                          <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
                          {auditEntries.map(entry => (
                            <div key={entry.id} className="relative">
                              <div className="absolute -left-2.5 top-1 w-2 h-2 rounded-full bg-primary" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge className={`text-[9px] ${actionColors[entry.action] || "bg-muted text-muted-foreground"}`}>{entry.action}</Badge>
                                  <span className="text-[10px] text-muted-foreground">{format(parseISO(entry.created_at), "MMM d, h:mm a")}</span>
                                </div>
                                {entry.details && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {String(entry.details.reason ?? entry.details.title ?? JSON.stringify(entry.details))}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
