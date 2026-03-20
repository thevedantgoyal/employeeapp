import { useState } from "react";
import {
  Request,
  REQUEST_TYPE_LABELS,
  REQUEST_PRIORITY_LABELS,
  useApproveRequest,
  useRejectRequest,
  useForwardRequest,
  useCancelRequest,
  useEditRequest,
  useIsTopLevel,
} from "@/hooks/useRequests";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RequestTrail } from "./RequestTrail";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle, XCircle, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  forwarded: "bg-blue-500/10 text-blue-600",
  approved: "bg-green-500/10 text-green-600",
  rejected: "bg-red-500/10 text-red-600",
  cancelled: "bg-muted text-muted-foreground",
};

interface RequestDetailProps {
  request: Request | null;
  isManagerView?: boolean;
  onClose: () => void;
  onEditSuccess?: () => void;
}

export function RequestDetail({ request, isManagerView, onClose, onEditSuccess }: RequestDetailProps) {
  const { user } = useAuth();
  const { isTopLevel } = useIsTopLevel();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [forwardNote, setForwardNote] = useState("");
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const approveRequest = useApproveRequest();
  const rejectRequest = useRejectRequest();
  const forwardRequest = useForwardRequest();
  const cancelRequest = useCancelRequest();
  const editRequest = useEditRequest();

  const isSubmitter = request?.submitted_by === user?.id;
  const isCurrentHandler = request?.current_handler === user?.id;
  const canActAsHandler = isCurrentHandler && (request?.status === "pending" || request?.status === "forwarded");
  const canEditOrCancel = isSubmitter && request?.status === "pending";

  if (!request) return null;

  const handleApprove = async () => {
    try {
      await approveRequest.mutateAsync(request.id);
      toast.success("Request approved");
      setApproveConfirmOpen(false);
      onClose();
    } catch {
      toast.error("Failed to approve");
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Reason is required");
      return;
    }
    try {
      await rejectRequest.mutateAsync({ requestId: request.id, reason: rejectReason.trim() });
      toast.success("Request rejected");
      setRejectOpen(false);
      setRejectReason("");
      onClose();
    } catch {
      toast.error("Failed to reject");
    }
  };

  const handleForward = async () => {
    if (!forwardNote.trim()) {
      toast.error("Note is required");
      return;
    }
    try {
      await forwardRequest.mutateAsync({ requestId: request.id, note: forwardNote.trim() });
      toast.success("Request forwarded");
      setForwardOpen(false);
      setForwardNote("");
      onClose();
    } catch {
      toast.error("Failed to forward");
    }
  };

  const handleCancel = async () => {
    try {
      await cancelRequest.mutateAsync(request.id);
      toast.success("Request cancelled");
      setCancelConfirmOpen(false);
      onClose();
    } catch {
      toast.error("Failed to cancel");
    }
  };

  const handleEditSubmit = async (data: { title: string; description?: string; request_type: string; priority: string }) => {
    try {
      await editRequest.mutateAsync({
        requestId: request.id,
        title: data.title,
        description: data.description,
        request_type: data.request_type,
        priority: data.priority,
      });
      toast.success("Request updated");
      setEditing(false);
      onEditSuccess?.();
    } catch {
      toast.error("Failed to update");
    }
  };

  const trail = request.trail && (Array.isArray(request.trail) ? request.trail : []);

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              {isManagerView && request.submitted_by_name && (
                <p className="text-sm text-muted-foreground mb-1">Submitted by {request.submitted_by_name}</p>
              )}
              <h2 className="text-xl font-semibold">{request.title}</h2>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{REQUEST_TYPE_LABELS[request.request_type] ?? request.request_type}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{REQUEST_PRIORITY_LABELS[request.priority] ?? request.priority}</span>
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusStyles[request.status])}>{request.status}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {request.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.description}</p>}
          {request.status === "rejected" && request.rejection_reason && (
            <div className="p-3 rounded-lg bg-red-500/10 text-red-700 text-sm border border-red-500/20">
              <strong>Rejection reason:</strong> {request.rejection_reason}
            </div>
          )}
          {request.status === "forwarded" && request.forward_note && (
            <div className="p-3 rounded-lg bg-blue-500/10 text-blue-700 text-sm border border-blue-500/20">
              <strong>Forward note:</strong> {request.forward_note}
            </div>
          )}

          <RequestTrail trail={trail} submittedByUserId={request.submitted_by} />

          {/* Manager actions */}
          {isManagerView && (
            <>
              {canActAsHandler ? (
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  <Button onClick={() => setApproveConfirmOpen(true)} className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="w-4 h-4 mr-2" /> Approve
                  </Button>
                  <Button variant="destructive" onClick={() => setRejectOpen(true)}>
                    <XCircle className="w-4 h-4 mr-2" /> Reject
                  </Button>
                  {!isTopLevel && (
                    <Button variant="outline" onClick={() => setForwardOpen(true)}>
                      <ArrowUp className="w-4 h-4 mr-2" /> Forward
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground pt-2">No action required</p>
              )}
            </>
          )}

          {/* Submitter actions (pending only) */}
          {!isManagerView && canEditOrCancel && (
            <div className="flex flex-wrap gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="w-4 h-4 mr-2" /> Edit Request
              </Button>
              <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => setCancelConfirmOpen(true)}>
                <Trash2 className="w-4 h-4 mr-2" /> Cancel Request
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit inline: we show a simple edit form in place when editing is true. Reusing full form state would need a separate edit form component. For now we can open a dialog/sheet with edit fields or navigate. Spec says "Edit Request → edit form". I'll add a simple edit sheet that pre-fills and calls editRequest. */}
      {editing && (
        <Sheet open={editing} onOpenChange={setEditing}>
          <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Edit Request</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <EditRequestForm
                request={request}
                onSave={handleEditSubmit}
                onCancel={() => setEditing(false)}
                isSaving={editRequest.isPending}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Reject sheet */}
      <Sheet open={rejectOpen} onOpenChange={setRejectOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[90vh]">
          <SheetHeader>
            <SheetTitle>Reject Request</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <Label>Reason (required)</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Provide a reason for rejection..."
              rows={4}
              className="resize-none"
            />
            <div className="flex gap-2">
              <Button onClick={handleReject} disabled={!rejectReason.trim() || rejectRequest.isPending} variant="destructive">
                Confirm Reject
              </Button>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Forward sheet */}
      <Sheet open={forwardOpen} onOpenChange={setForwardOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[90vh]">
          <SheetHeader>
            <SheetTitle>Forward to Your Manager</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <Label>Note for your manager (required)</Label>
            <Textarea
              value={forwardNote}
              onChange={(e) => setForwardNote(e.target.value)}
              placeholder="Add a note..."
              rows={4}
              className="resize-none"
            />
            <div className="flex gap-2">
              <Button onClick={handleForward} disabled={!forwardNote.trim() || forwardRequest.isPending}>
                Confirm Forward
              </Button>
              <Button variant="outline" onClick={() => setForwardOpen(false)}>Cancel</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel request?</AlertDialogTitle>
            <AlertDialogDescription>This will cancel the request. Your manager will be notified.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancel Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={approveConfirmOpen} onOpenChange={setApproveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve request?</AlertDialogTitle>
            <AlertDialogDescription>The submitter will be notified.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Inline edit form (title, description, type, priority) */
function EditRequestForm({
  request,
  onSave,
  onCancel,
  isSaving,
}: {
  request: Request;
  onSave: (data: { title: string; description?: string; request_type: string; priority: string }) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState(request.title);
  const [description, setDescription] = useState(request.description ?? "");
  const [requestType, setRequestType] = useState(request.request_type);
  const [priority, setPriority] = useState(request.priority);

  return (
    <div className="space-y-4">
      <div>
        <Label>Title *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" required />
      </div>
      <div>
        <Label>Request Type</Label>
        <select
          value={requestType}
          onChange={(e) => setRequestType(e.target.value as Request["request_type"])}
          className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3"
        >
          {(Object.keys(REQUEST_TYPE_LABELS) as (keyof typeof REQUEST_TYPE_LABELS)[]).map((t) => (
            <option key={t} value={t}>{REQUEST_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>
      <div>
        <Label>Priority</Label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Request["priority"])}
          className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3"
        >
          {(Object.keys(REQUEST_PRIORITY_LABELS) as (keyof typeof REQUEST_PRIORITY_LABELS)[]).map((p) => (
            <option key={p} value={p}>{REQUEST_PRIORITY_LABELS[p]}</option>
          ))}
        </select>
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="mt-1 resize-none" />
      </div>
      <div className="flex gap-2">
        <Button onClick={() => onSave({ title, description: description || undefined, request_type: requestType, priority })} disabled={!title.trim() || isSaving}>
          Save
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
