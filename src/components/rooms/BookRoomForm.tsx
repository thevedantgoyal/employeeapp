import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { CalendarIcon, AlertTriangle, Clock, X, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/integrations/api/client";
import type { MeetingRoom, RoomBooking } from "@/hooks/useRoomBooking";

const DEBOUNCE_MS = 300;

export interface UserOption {
  id: string;
  email: string;
  full_name: string;
}

interface BookRoomFormProps {
  rooms: MeetingRoom[];
  onBook: (booking: {
    room_id: string; title: string; purpose?: string; meeting_type: string;
    priority: string; booking_date: string; start_time: string; end_time: string;
    participants?: string[];
  }) => Promise<RoomBooking | null>;
}

const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = i % 2 === 0 ? "00" : "30";
  if (h > 19) return null;
  return `${String(h).padStart(2, "0")}:${m}`;
}).filter(Boolean) as string[];

export const BookRoomForm = ({ rooms, onBook }: BookRoomFormProps) => {
  const [form, setForm] = useState({
    room_id: "", title: "", purpose: "", meeting_type: "internal",
    priority: "normal", start_time: "", end_time: "",
  });
  const [date, setDate] = useState<Date>();
  const [submitting, setSubmitting] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<UserOption[]>([]);
  const [suggestions, setSuggestions] = useState<UserOption[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeRooms = rooms.filter(r => r.status === "active");

  const searchUsers = useCallback(async (term: string) => {
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    setSearchLoading(true);
    const { data, error } = await api.get<UserOption[]>("/users", { search: term, limit: "20" });
    setSearchLoading(false);
    if (error || !data) {
      setSuggestions([]);
      return;
    }
    setSuggestions(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchUsers(participantSearch);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [participantSearch, searchUsers]);

  const addParticipant = (u: UserOption) => {
    if (selectedParticipants.some(p => p.id === u.id)) return;
    setSelectedParticipants(prev => [...prev, u]);
    setParticipantSearch("");
    setSuggestionsOpen(false);
  };

  const removeParticipant = (id: string) => {
    setSelectedParticipants(prev => prev.filter(p => p.id !== id));
  };

  const filteredSuggestions = suggestions.filter(s => !selectedParticipants.some(p => p.id === s.id));

  const validate = () => {
    const w: string[] = [];
    if (!form.room_id || !form.title.trim() || !date || !form.start_time || !form.end_time) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) w.push("Cannot book past time slots.");

    const [sh, sm] = form.start_time.split(":").map(Number);
    const [eh, em] = form.end_time.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (endMin <= startMin) w.push("End time must be after start time.");
    if (startMin < 8 * 60 || endMin > 20 * 60) w.push("Bookings outside office hours (8:00–20:00) are not permitted.");
    if (endMin - startMin > 240) w.push("Warning: Booking exceeds 4 hours. Please confirm this is required.");

    setWarnings(w);
    return w.filter(x => !x.startsWith("Warning")).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !date) return;
    setSubmitting(true);
    const participantIds = selectedParticipants.map(p => p.id);
    await onBook({
      room_id: form.room_id,
      title: form.title.trim(),
      purpose: form.purpose.trim() || undefined,
      meeting_type: form.meeting_type,
      priority: form.priority,
      booking_date: format(date, "yyyy-MM-dd"),
      start_time: form.start_time + ":00",
      end_time: form.end_time + ":00",
      participants: participantIds.length > 0 ? participantIds : undefined,
    });
    setSubmitting(false);
    setForm({ room_id: "", title: "", purpose: "", meeting_type: "internal", priority: "normal", start_time: "", end_time: "" });
    setSelectedParticipants([]);
    setDate(undefined);
    setWarnings([]);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display">Book a Meeting Room</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Room *</Label>
          <Select value={form.room_id} onValueChange={v => setForm(f => ({ ...f, room_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
            <SelectContent>
              {activeRooms.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.name} — {r.location} (Cap: {r.capacity})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div><Label>Meeting Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Weekly Standup" maxLength={100} /></div>
        <div><Label>Purpose</Label><Textarea value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} placeholder="Describe the meeting purpose..." rows={2} maxLength={500} /></div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Meeting Type</Label>
            <Select value={form.meeting_type} onValueChange={v => setForm(f => ({ ...f, meeting_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="leadership">Leadership</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="leadership">Leadership</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Date *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={setDate} disabled={d => d < new Date(new Date().setHours(0, 0, 0, 0))} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Start Time *</Label>
            <Select value={form.start_time} onValueChange={v => setForm(f => ({ ...f, start_time: v }))}>
              <SelectTrigger><SelectValue placeholder="Start" /></SelectTrigger>
              <SelectContent>{TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>End Time *</Label>
            <Select value={form.end_time} onValueChange={v => setForm(f => ({ ...f, end_time: v }))}>
              <SelectTrigger><SelectValue placeholder="End" /></SelectTrigger>
              <SelectContent>{TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Participants</Label>
          <div className="relative">
            <Input
              value={participantSearch}
              onChange={e => {
                setParticipantSearch(e.target.value);
                setSuggestionsOpen(true);
              }}
              onFocus={() => participantSearch.length >= 2 && setSuggestionsOpen(true)}
              onBlur={() => setTimeout(() => setSuggestionsOpen(false), 150)}
              placeholder="Search by name or email..."
              className="pr-8"
            />
            <Users className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          {suggestionsOpen && (participantSearch.length >= 2 || filteredSuggestions.length > 0) && (
            <div className="border border-border rounded-md bg-popover shadow-md max-h-48 overflow-y-auto z-10">
              {searchLoading ? (
                <p className="p-2 text-xs text-muted-foreground">Searching...</p>
              ) : filteredSuggestions.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">No users found.</p>
              ) : (
                filteredSuggestions.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted focus:bg-muted focus:outline-none flex flex-col"
                    onMouseDown={() => addParticipant(u)}
                  >
                    <span className="font-medium">{u.full_name || "—"}</span>
                    <span className="text-xs text-muted-foreground">{u.email}</span>
                  </button>
                ))
              )}
            </div>
          )}
          {selectedParticipants.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedParticipants.map(p => (
                <Badge key={p.id} variant="secondary" className="gap-1 pr-1">
                  {p.full_name || p.email}
                  <button
                    type="button"
                    className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    onClick={() => removeParticipant(p.id)}
                    aria-label={`Remove ${p.full_name || p.email}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {warnings.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {warnings.map((w, i) => <p key={i} className="text-xs">{w}</p>)}
            </AlertDescription>
          </Alert>
        )}

        <p className="text-[10px] text-muted-foreground italic">All meeting bookings are recorded for organizational transparency.</p>

        <Button onClick={handleSubmit} className="w-full" disabled={submitting || !form.room_id || !form.title.trim() || !date || !form.start_time || !form.end_time}>
          {submitting ? "Booking..." : "Confirm Booking"}
        </Button>
      </CardContent>
    </Card>
  );
};
