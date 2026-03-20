import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/integrations/api/db";
import { api } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface MeetingRoom {
  id: string;
  name: string;
  location: string;
  floor: string | null;
  capacity: number;
  has_projector: boolean;
  has_video_conferencing: boolean;
  has_whiteboard: boolean;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RoomBooking {
  id: string;
  room_id: string;
  booked_by: string;
  booked_by_name?: string | null;
  title: string;
  purpose: string | null;
  project_id: string | null;
  meeting_type: string;
  priority: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  participants: string[] | null;
  status: string;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  room?: MeetingRoom;
}

export interface AuditLogEntry {
  id: string;
  booking_id: string;
  action: string;
  performed_by: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export const useRoomBooking = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [myBookings, setMyBookings] = useState<RoomBooking[]>([]);
  const [invitedBookings, setInvitedBookings] = useState<RoomBooking[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditUnseenCount, setAuditUnseenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const requestedDateRef = useRef<string | undefined>(undefined);

  const fetchRooms = useCallback(async () => {
    const { data, error } = await db
      .from("meeting_rooms")
      .select("*")
      .order("name");
    if (error) return;
    // Backend returns { data: rows }; client gives us data = rows. Handle both array and wrapped shape.
    const list = Array.isArray(data)
      ? data
      : (data && typeof data === "object" && "data" in data && Array.isArray((data as { data?: unknown }).data))
        ? (data as { data: MeetingRoom[] }).data
        : [];
    setRooms(list as MeetingRoom[]);
  }, []);

  const fetchBookings = useCallback(async (date?: string) => {
    if (date !== undefined) requestedDateRef.current = date;
    console.log("[RoomGrid] API request params:", { booking_date: date ?? "(all)", status_neq: "cancelled", order: "start_time" });
    let query = db
      .from("room_bookings")
      .select("*")
      .neq("status", "cancelled")
      .order("booking_date")
      .order("start_time");
    if (date) query = query.eq("booking_date", date);
    const { data, error } = await query;
    if (error) {
      console.log("[RoomGrid] API error:", error);
      if (date === undefined) {
        console.log("[RoomGrid] Bookings state cleared (API error, no date)");
        setBookings([]);
      } else if (requestedDateRef.current === date) {
        console.log("[RoomGrid] Bookings state cleared (API error, date fetch)");
        setBookings([]);
      }
      return;
    }
    // Handle both direct array and wrapped { data: rows } from API
    const raw = data ?? null;
    const list = Array.isArray(raw)
      ? raw
      : (raw && typeof raw === "object" && "data" in raw && Array.isArray((raw as { data?: unknown }).data))
        ? (raw as { data: unknown[] }).data
        : [];
    console.log("[RoomGrid] API response - booking count:", list.length, "| raw sample:", (list as RoomBooking[])[0]?.booking_date);
    // When a date-specific fetch was requested, only that fetch should update state.
    // If we're the no-date fetch and the grid already requested a specific date, don't overwrite (avoids flash-then-blank).
    if (date === undefined && requestedDateRef.current !== undefined) {
      console.log("[RoomGrid] Skipping setBookings (no-date fetch; grid requested date):", requestedDateRef.current);
      return;
    }
    if (date !== undefined && requestedDateRef.current !== date) {
      console.log("[RoomGrid] Skipping setBookings (stale date fetch):", date, "!== current:", requestedDateRef.current);
      return;
    }
    console.log("[RoomGrid] Setting bookings state, count:", list.length);
    setBookings(list as RoomBooking[]);
  }, []);

  const fetchMyBookings = useCallback(async () => {
    if (!user) return;
    const { data, error } = await db
      .from("room_bookings")
      .select("*")
      .eq("booked_by", user.id)
      .order("booking_date", { ascending: false })
      .order("start_time");
    if (!error && data) setMyBookings(data as unknown as RoomBooking[]);
  }, [user]);

  const fetchInvitedBookings = useCallback(async () => {
    if (!user) return;
    const { data, error } = await db
      .from("room_bookings")
      .select("*")
      .eq("invited", "true")
      .neq("status", "cancelled")
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (!error && data) setInvitedBookings(data as unknown as RoomBooking[]);
  }, [user]);

  const fetchAuditLog = useCallback(async (bookingId: string) => {
    const { data, error } = await db
      .from("booking_audit_log")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false });
    if (!error && data) setAuditLog(data as unknown as AuditLogEntry[]);
    return data as unknown as AuditLogEntry[] | null;
  }, []);

  const checkConflict = useCallback(async (
    roomId: string, bookingDate: string, startTime: string, endTime: string, excludeId?: string
  ) => {
    const body: Record<string, unknown> = {
      _room_id: roomId,
      _booking_date: bookingDate,
      _start_time: startTime,
      _end_time: endTime,
    };
    if (excludeId != null && excludeId !== "") body._exclude_id = excludeId;
    const { data, error } = await db.rpc("check_booking_conflict", body);
    if (error) return [];
    return (data as unknown[]) || [];
  }, []);

  const createRoom = useCallback(async (room: Omit<MeetingRoom, "id" | "created_at" | "updated_at" | "created_by">) => {
    if (!user) return null;
    const { data, error } = await db
      .from("meeting_rooms")
      .insert({ ...room, created_by: user.id })
      .select()
      .single();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return null;
    }
    toast({ title: "Room Created", description: `${room.name} has been added.` });
    await fetchRooms();
    return data;
  }, [user, toast, fetchRooms]);

  const createBooking = useCallback(async (booking: {
    room_id: string; title: string; purpose?: string; project_id?: string;
    meeting_type: string; priority: string; booking_date: string;
    start_time: string; end_time: string; participants?: string[];
  }) => {
    if (!user) return null;
    const conflicts = await checkConflict(booking.room_id, booking.booking_date, booking.start_time, booking.end_time);
    if (conflicts.length > 0) {
      const priorityOrder: Record<string, number> = { normal: 0, high: 1, leadership: 2 };
      const conflictPriorities = conflicts.map((c: Record<string, unknown>) => c.priority as string);
      const bookingPriority = priorityOrder[booking.priority] ?? 0;
      const maxConflictPriority = Math.max(...conflictPriorities.map((p: string) => priorityOrder[p] ?? 0));
      if (bookingPriority <= maxConflictPriority) {
        toast({
          title: "Slot Unavailable",
          description: "This slot is already reserved. Higher-priority meetings require management override.",
          variant: "destructive",
        });
        return null;
      }
    }

    const { data, error } = await db
      .from("room_bookings")
      .insert({ ...booking, booked_by: user.id })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return null;
    }

    // Log audit
    await db.from("booking_audit_log").insert({
      booking_id: (data as Record<string, unknown>)?.id as string,
      action: "created",
      performed_by: user.id,
      details: { title: booking.title, priority: booking.priority },
    });

    toast({ title: "Booking Confirmed", description: `"${booking.title}" has been scheduled.` });
    await Promise.all([fetchBookings(booking.booking_date), fetchMyBookings(), fetchInvitedBookings()]);
    return data;
  }, [user, toast, checkConflict, fetchBookings, fetchMyBookings, fetchInvitedBookings]);

  const cancelBooking = useCallback(async (bookingId: string, reason: string) => {
    if (!user) return;
    const { error } = await db
      .from("room_bookings")
      .update({ status: "cancelled", cancellation_reason: reason })
      .eq("id", bookingId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    await db.from("booking_audit_log").insert({
      booking_id: bookingId,
      action: "cancelled",
      performed_by: user.id,
      details: { reason },
    });

    toast({ title: "Booking Cancelled" });
    await Promise.all([fetchBookings(), fetchMyBookings(), fetchInvitedBookings()]);
  }, [user, toast, fetchBookings, fetchMyBookings, fetchInvitedBookings]);

  const rescheduleBooking = useCallback(
    async (
      bookingId: string,
      payload: { room_id: string; booking_date: string; start_time: string; end_time: string }
    ) => {
      const { error } = await api.patch<{ id: string }>(
        `/room_bookings/${bookingId}/reschedule`,
        payload
      );
      if (error) {
        toast({
          title: error.message.includes("Room not available")
            ? "Slot Unavailable"
            : "Error",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }
      toast({ title: "Meeting rescheduled successfully" });
      await Promise.all([fetchBookings(), fetchMyBookings(), fetchInvitedBookings()]);
    },
    [toast, fetchBookings, fetchMyBookings, fetchInvitedBookings]
  );

  const fetchAuditUnseenCount = useCallback(async () => {
    if (!user) return;
    const { data, error } = await api.get<number>("/room_bookings/audit-unseen-count");
    if (!error && typeof data === "number") setAuditUnseenCount(data);
  }, [user]);

  const markAuditSeen = useCallback(async () => {
    if (!user) return;
    await api.post("/room_bookings/audit-mark-seen");
    setAuditUnseenCount(0);
  }, [user]);

  const updateRoom = useCallback(async (id: string, updates: Partial<MeetingRoom>) => {
    const { error } = await db
      .from("meeting_rooms")
      .update(updates)
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Room Updated" });
    await fetchRooms();
  }, [toast, fetchRooms]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchRooms(), fetchBookings(), fetchMyBookings(), fetchInvitedBookings()]);
      setLoading(false);
    };
    init();
  }, [fetchRooms, fetchBookings, fetchMyBookings, fetchInvitedBookings]);

  return {
    rooms, bookings, myBookings, invitedBookings, auditLog, auditUnseenCount, loading,
    fetchRooms, fetchBookings, fetchMyBookings, fetchInvitedBookings, fetchAuditLog,
    fetchAuditUnseenCount, markAuditSeen,
    checkConflict, createRoom, createBooking, cancelBooking, rescheduleBooking, updateRoom,
  };
};
