import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarIcon, FileText, AlertCircle, ExternalLink, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { ProjectOption, WorkType } from "@/hooks/useTimesheetManagement";
import { WORK_TYPES } from "@/hooks/useTimesheetManagement";
import { FileUploader, type UploadedFileInfo } from "@/components/upload/FileUploader";

interface Props {
  projects: ProjectOption[];
  validate: (
    date: Date | undefined,
    workType: WorkType,
    projectId: string,
    taskId: string,
    activityTitle: string,
    hours: number,
    description: string
  ) => string | null;
  onSubmit: (
    date: Date,
    workType: WorkType,
    projectId: string,
    taskId: string,
    activityTitle: string,
    hours: number,
    description: string,
    attachment: string | null
  ) => void;
  onCancel: () => void;
}

export const LogTimeForm = ({ projects, validate, onSubmit, onCancel }: Props) => {
  const [date, setDate] = useState<Date>();
  const [workType, setWorkType] = useState<WorkType>("Project Work");
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [activityTitle, setActivityTitle] = useState("");
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");
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

  const selectedProject = projects.find((p) => p.id === projectId);
  const tasks = selectedProject?.tasks || [];
  const isProjectWork = workType === "Project Work";

  const handleProjectChange = (val: string) => {
    setProjectId(val);
    setTaskId("");
  };

  const handleSubmit = () => {
    const h = parseFloat(hours);
    const err = validate(date, workType, projectId, taskId, activityTitle, isNaN(h) ? 0 : h, description);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onSubmit(date!, workType, projectId, taskId, activityTitle, h, description, attachmentUrl);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <button onClick={onCancel} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h2 className="text-lg font-semibold">Log Time Entry</h2>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "dd MMM yyyy") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={setDate} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Work Type</Label>
          <Select value={workType} onValueChange={(v) => setWorkType(v as WorkType)}>
            <SelectTrigger><SelectValue placeholder="Select work type" /></SelectTrigger>
            <SelectContent>
              {WORK_TYPES.map((wt) => (
                <SelectItem key={wt} value={wt}>{wt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isProjectWork ? (
          <>
            <div className="space-y-2">
              <Label>Project <span className="text-destructive">*</span></Label>
              <Select value={projectId} onValueChange={handleProjectChange}>
                <SelectTrigger><SelectValue placeholder="Select assigned project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Task <span className="text-destructive">*</span></Label>
              <Select value={taskId} onValueChange={setTaskId} disabled={!projectId}>
                <SelectTrigger><SelectValue placeholder={projectId ? "Select task" : "Select a project first"} /></SelectTrigger>
                <SelectContent>
                  {tasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label>Activity Title <span className="text-destructive">*</span></Label>
            <Input
              placeholder="e.g. Team standup, Training session..."
              value={activityTitle}
              onChange={(e) => setActivityTitle(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Hours Worked</Label>
          <Input
            type="number"
            min="0.5"
            max="24"
            step="0.5"
            placeholder="e.g. 4"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Description (Optional)</Label>
          <Textarea
            placeholder="Additional notes..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label>Evidence (Optional)</Label>
          <FileUploader
            multiple={false}
            maxFileSizeMB={10}
            bucket="evidence"
            label="Attach Evidence"
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

        <Button onClick={handleSubmit} className="w-full" size="lg">
          Save Entry
        </Button>
      </div>
    </motion.div>
  );
};
