import { useState } from "react";
import { Plus, Monitor, Video, PenLine, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MeetingRoom } from "@/hooks/useRoomBooking";

interface RoomManagementProps {
  rooms: MeetingRoom[];
  onCreateRoom: (room: Omit<MeetingRoom, "id" | "created_at" | "updated_at" | "created_by">) => Promise<MeetingRoom | null>;
  onUpdateRoom: (id: string, updates: Partial<MeetingRoom>) => Promise<void>;
}

export const RoomManagement = ({ rooms, onCreateRoom, onUpdateRoom }: RoomManagementProps) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", location: "", floor: "", capacity: 10,
    has_projector: false, has_video_conferencing: false, has_whiteboard: false, status: "active",
  });

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.location.trim()) return;
    await onCreateRoom({ ...form, capacity: Number(form.capacity) });
    setForm({ name: "", location: "", floor: "", capacity: 10, has_projector: false, has_video_conferencing: false, has_whiteboard: false, status: "active" });
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-display font-semibold">Meeting Rooms</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" /> Add Room
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md" aria-describedby={undefined}>
            <DialogHeader><DialogTitle>Add Meeting Room</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Room Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Board Room A" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Location *</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Building 1" /></div>
                <div><Label>Floor</Label><Input value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))} placeholder="3rd Floor" /></div>
              </div>
              <div><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: parseInt(e.target.value) || 1 }))} /></div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Equipment</Label>
                {[
                  { key: "has_projector", label: "Projector", icon: Monitor },
                  { key: "has_video_conferencing", label: "Video Conferencing", icon: Video },
                  { key: "has_whiteboard", label: "Whiteboard", icon: PenLine },
                ].map(({ key, label, icon: Icon }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Icon className="w-4 h-4 text-muted-foreground" /><span className="text-sm">{label}</span></div>
                    <Switch checked={(form as Record<string, unknown>)[key] as boolean} onCheckedChange={v => setForm(f => ({ ...f, [key]: v }))} />
                  </div>
                ))}
              </div>
              <Button onClick={handleSubmit} className="w-full">Create Room</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {rooms.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No meeting rooms configured yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rooms.map(room => (
            <Card key={room.id} className="card-hover">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">{room.name}</h3>
                    <p className="text-xs text-muted-foreground">{room.location}{room.floor ? ` · ${room.floor}` : ""}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Capacity: {room.capacity} people</p>
                    <div className="flex gap-1.5 mt-2">
                      {room.has_projector && <Badge variant="secondary" className="text-[10px] py-0"><Monitor className="w-3 h-3 mr-1" />Projector</Badge>}
                      {room.has_video_conferencing && <Badge variant="secondary" className="text-[10px] py-0"><Video className="w-3 h-3 mr-1" />VC</Badge>}
                      {room.has_whiteboard && <Badge variant="secondary" className="text-[10px] py-0"><PenLine className="w-3 h-3 mr-1" />Board</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={room.status === "active" ? "default" : "destructive"} className="text-[10px]">
                      {room.status === "active" ? "Active" : "Maintenance"}
                    </Badge>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => onUpdateRoom(room.id, { status: room.status === "active" ? "maintenance" : "active" })}
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
