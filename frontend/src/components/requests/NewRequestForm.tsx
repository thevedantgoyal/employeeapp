import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateRequest, REQUEST_TYPE_LABELS, REQUEST_PRIORITY_LABELS, type RequestType, type RequestPriority } from "@/hooks/useRequests";
import { toast } from "sonner";

interface NewRequestFormProps {
  onSuccess: () => void;
}

const REQUEST_TYPES: RequestType[] = ["resource", "task_deadline", "task_reassignment", "general"];
const PRIORITIES: RequestPriority[] = ["low", "normal", "high", "urgent"];

export function NewRequestForm({ onSuccess }: NewRequestFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestType, setRequestType] = useState<RequestType>("general");
  const [priority, setPriority] = useState<RequestPriority>("normal");

  const createRequest = useCreateRequest();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    try {
      await createRequest.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        request_type: requestType,
        priority,
      });
      toast.success("Request submitted");
      setTitle("");
      setDescription("");
      setRequestType("general");
      setPriority("normal");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit request");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Brief title for your request"
          className="mt-1"
          required
        />
      </div>
      <div>
        <Label>Request Type</Label>
        <Select value={requestType} onValueChange={(v) => setRequestType(v as RequestType)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REQUEST_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {REQUEST_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Priority</Label>
        <Select value={priority} onValueChange={(v) => setPriority(v as RequestPriority)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {REQUEST_PRIORITY_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add details..."
          rows={4}
          className="mt-1 resize-none"
        />
      </div>
      <Button type="submit" className="w-full" disabled={createRequest.isPending || !title.trim()}>
        {createRequest.isPending ? "Submitting..." : "Submit Request"}
      </Button>
    </form>
  );
}
