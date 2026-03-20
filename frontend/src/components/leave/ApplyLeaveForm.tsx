import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarIcon, FileText, AlertCircle, ExternalLink, X } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { LeaveBalance } from "@/hooks/useLeaveManagement";
import { FileUploader, type UploadedFileInfo } from "@/components/upload/FileUploader";

interface Props {
  balances: LeaveBalance[];
  calculateDays: (from: Date, to: Date, halfDay: boolean) => number;
  validate: (code: string, from: Date | undefined, to: Date | undefined, reason: string) => string | null;
  onSubmit: (code: string, from: Date, to: Date, halfDay: boolean, reason: string, attachment: string | null) => void;
  onCancel: () => void;
}

export const ApplyLeaveForm = ({ balances, calculateDays, validate, onSubmit, onCancel }: Props) => {
  const [step, setStep] = useState<"form" | "review">("form");
  const [leaveCode, setLeaveCode] = useState("");
  const [fromDate, setFromDate] = useState<Date>();
  const [toDate, setToDate] = useState<Date>();
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onUploadComplete = (files: UploadedFileInfo[]) => {
    const f = files[0];
    if (f) {
      setAttachmentUrl(f.url);
      setAttachmentName(f.name);
    }
  };

  const selectedBalance = balances.find((b) => b.code === leaveCode);
  const daysCount = fromDate && toDate ? calculateDays(fromDate, toDate, halfDay) : 0;
  const remainingAfter = selectedBalance ? selectedBalance.remaining - daysCount : 0;

  const handleProceedToReview = () => {
    const err = validate(leaveCode, fromDate, toDate, reason);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep("review");
  };

  const handleSubmit = () => {
    if (fromDate && toDate) {
      onSubmit(leaveCode, fromDate, toDate, halfDay, reason, attachmentUrl);
    }
  };

  if (step === "review") {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <button onClick={() => setStep("form")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to form
        </button>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Review Leave Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Leave Type</p>
                <p className="font-medium">{selectedBalance?.type}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Duration</p>
                <p className="font-medium">{daysCount} day(s){halfDay ? " (half-day)" : ""}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">From</p>
                <p className="font-medium">{fromDate ? format(fromDate, "dd MMM yyyy") : ""}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">To</p>
                <p className="font-medium">{toDate ? format(toDate, "dd MMM yyyy") : ""}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground text-xs">Reason</p>
                <p className="font-medium">{reason}</p>
              </div>
              {attachmentName && (
                <div className="col-span-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{attachmentName}</span>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Balance after approval</span>
                <span className={cn("font-bold", remainingAfter < 0 ? "text-destructive" : "text-foreground")}>
                  {remainingAfter} day(s)
                </span>
              </div>
              <Badge variant="secondary" className="mt-2">Status: Pending Approval</Badge>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSubmit} className="w-full" size="lg">
          Submit Leave Request
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <button onClick={onCancel} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h2 className="text-lg font-semibold">Apply Leave</h2>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Leave Type</Label>
          <Select value={leaveCode} onValueChange={setLeaveCode}>
            <SelectTrigger><SelectValue placeholder="Select leave type" /></SelectTrigger>
            <SelectContent>
              {balances.map((b) => (
                <SelectItem key={b.code} value={b.code}>
                  {b.type} ({b.remaining} remaining)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>From Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !fromDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fromDate ? format(fromDate, "dd MMM") : "Pick"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>To Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !toDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {toDate ? format(toDate, "dd MMM") : "Pick"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="half-day">Half-Day</Label>
          <Switch id="half-day" checked={halfDay} onCheckedChange={setHalfDay} />
        </div>

        <div className="space-y-2">
          <Label>Reason <span className="text-destructive">*</span></Label>
          <Textarea
            placeholder="Provide a reason for leave..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Attachment (Optional)</Label>
          <FileUploader
            multiple={false}
            allowedTypes={["image/*", "application/pdf", ".doc", ".docx"]}
            maxFileSizeMB={10}
            bucket="evidence"
            label="Attach Document"
            onUploadComplete={onUploadComplete}
          />
          {attachmentUrl && attachmentName && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm truncate flex-1">{attachmentName}</span>
              <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline flex items-center gap-1">
                View <ExternalLink className="w-3 h-3" />
              </a>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { setAttachmentUrl(null); setAttachmentName(null); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {fromDate && toDate && leaveCode && (
          <Card className="border-border/50">
            <CardContent className="p-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-semibold">{daysCount} day(s){halfDay ? " (half-day)" : ""}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Button onClick={handleProceedToReview} className="w-full" size="lg">
          Review & Submit
        </Button>
      </div>
    </motion.div>
  );
};
