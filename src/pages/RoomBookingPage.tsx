import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarCheck, Plus, Clock, Shield, Settings2 } from "lucide-react";
import { useRoomBooking } from "@/hooks/useRoomBooking";
import { useUserRoles } from "@/hooks/useUserRoles";
import { RoomAvailability } from "@/components/rooms/RoomAvailability";
import { BookRoomForm } from "@/components/rooms/BookRoomForm";
import { MyMeetings } from "@/components/rooms/MyMeetings";
import { BookingAuditTrail } from "@/components/rooms/BookingAuditTrail";
import { RoomManagement } from "@/components/rooms/RoomManagement";
import { Skeleton } from "@/components/ui/skeleton";

const RoomBookingPage = () => {
  const {
    rooms, bookings, myBookings, invitedBookings, loading,
    fetchBookings, fetchAuditLog, fetchInvitedBookings, fetchMyBookings,
    fetchAuditUnseenCount, markAuditSeen, auditUnseenCount,
    createRoom, createBooking, cancelBooking, rescheduleBooking, updateRoom,
  } = useRoomBooking();
  const { isAdmin, isManager } = useUserRoles();
  const canManageRooms = isAdmin || isManager;
  const [tabValue, setTabValue] = useState("availability");

  useEffect(() => {
    fetchAuditUnseenCount();
  }, [fetchAuditUnseenCount]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchAuditUnseenCount();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [fetchAuditUnseenCount]);

  const handleTabChange = (v: string) => {
    setTabValue(v);
    if (v === "my") fetchMyBookings();
    if (v === "audit") {
      markAuditSeen();
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={tabValue} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-10">
          <TabsTrigger value="availability" className="text-xs gap-1">
            <CalendarCheck className="w-3.5 h-3.5 hidden sm:block" /> Rooms
          </TabsTrigger>
          <TabsTrigger value="book" className="text-xs gap-1">
            <Plus className="w-3.5 h-3.5 hidden sm:block" /> Book
          </TabsTrigger>
          <TabsTrigger value="my" className="text-xs gap-1">
            <Clock className="w-3.5 h-3.5 hidden sm:block" /> My
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-xs gap-1 relative">
            <Shield className="w-3.5 h-3.5 hidden sm:block" /> Audit
            {auditUnseenCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1">
                {auditUnseenCount > 9 ? "9+" : auditUnseenCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="availability" className="mt-3 space-y-4">
          <RoomAvailability rooms={rooms} bookings={bookings} onDateChange={(d) => fetchBookings(d)} />
          {canManageRooms && (
            <RoomManagement rooms={rooms} onCreateRoom={createRoom} onUpdateRoom={updateRoom} />
          )}
        </TabsContent>

        <TabsContent value="book" className="mt-3">
          <BookRoomForm rooms={rooms} onBook={createBooking} />
        </TabsContent>

        <TabsContent value="my" className="mt-3">
          <MyMeetings bookings={myBookings} rooms={rooms} onCancel={cancelBooking} onReschedule={rescheduleBooking} />
        </TabsContent>

        <TabsContent value="audit" className="mt-3">
          <BookingAuditTrail
            bookings={invitedBookings}
            rooms={rooms}
            fetchAuditLog={fetchAuditLog}
            fetchInvitedBookings={fetchInvitedBookings}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RoomBookingPage;
