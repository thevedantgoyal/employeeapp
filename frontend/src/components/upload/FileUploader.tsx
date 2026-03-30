import { useState, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Image, Video, FileSpreadsheet, File, Loader2, Plus, X } from "lucide-react";
import { db } from "@/integrations/api/db";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { compressAndConvertImage } from "@/hooks/useProfileManagement";

export interface UploadedFileInfo {
  id: string;
  url: string;
  name: string;
  size: number;
  type: string;
}

export interface FileUploaderProps {
  multiple?: boolean;
  allowedTypes?: string[];
  maxFileSizeMB?: number;
  onUploadComplete: (uploadedFiles: UploadedFileInfo[]) => void;
  label?: string;
  bucket?: string;
  /** Optional path prefix (e.g. "userId/"). Defaults to current user id + "/" */
  pathPrefix?: string;
  /** When true, only render input + dialog; use ref.openPicker() to open (e.g. from dropdown). */
  hideButton?: boolean;
  /** Mobile camera/gallery hint for profile photos (avatars). */
  capture?: "environment" | "user";
}

export interface FileUploaderRef {
  openPicker: () => void;
}

const MB = 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return Image;
  if (type.startsWith("video/")) return Video;
  if (type === "application/pdf") return FileText;
  if (
    type.includes("spreadsheet") ||
    type.includes("excel") ||
    type === "text/csv"
  )
    return FileSpreadsheet;
  if (type.includes("document") || type.includes("word")) return FileText;
  return File;
}

export const FileUploader = forwardRef<FileUploaderRef, FileUploaderProps>(function FileUploader({
  multiple = true,
  allowedTypes = [],
  maxFileSizeMB = 50,
  onUploadComplete,
  label = "Upload Files",
  bucket = "evidence",
  pathPrefix,
  hideButton = false,
  capture,
}, ref) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const isAvatarBucket = bucket === "avatars";
  const maxBytes = maxFileSizeMB * MB;
  /** Raw file cap before client compression (aligned with backend multer). */
  const rawMaxBytes = isAvatarBucket ? Math.max(maxBytes, 50 * MB) : maxBytes;
  const accept =
    allowedTypes.length > 0
      ? allowedTypes.join(",")
      : isAvatarBucket
        ? "image/*,.heic,.heif,.avif,.jfif,.bmp,.tif,.tiff,.svg"
        : undefined;
  const inputCapture = capture ?? (isAvatarBucket ? "environment" : undefined);

  const openPicker = useCallback(() => {
    setUploadError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.click();
    }
  }, []);

  useImperativeHandle(ref, () => ({ openPicker }), [openPicker]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const list = Array.from(files);
    const tooBig = list.find((f) => f.size > rawMaxBytes);
    if (tooBig) {
      toast.error(
        isAvatarBucket
          ? `File "${tooBig.name}" is too large before compression (max ${(rawMaxBytes / MB).toFixed(0)}MB). Try another photo.`
          : `File "${tooBig.name}" exceeds the size limit (${maxFileSizeMB}MB).`,
      );
      return;
    }
    setPendingFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const unique = list.filter((f) => !existingNames.has(f.name));
      // First open with single-file mode: keep only one file
      if (prev.length === 0 && !multiple) return unique.length ? [unique[0]] : prev;
      // Otherwise append (Add More or multi-select), skipping duplicates
      return [...prev, ...unique];
    });
    setDialogOpen(true);
    e.target.value = "";
  };

  const addMore = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.click();
    }
  };

  const removePending = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCancel = () => {
    setDialogOpen(false);
    setPendingFiles([]);
    setUploadError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const performUpload = async () => {
    if (!user || pendingFiles.length === 0) return;
    setUploading(true);
    setUploadError(null);
    const results: UploadedFileInfo[] = [];
    const total = pendingFiles.length;
    let done = 0;
    const toastId = "file-uploader-avatar";

    try {
      const prefix = pathPrefix ?? `${user.id}/`;
      for (const file of pendingFiles) {
        let fileToUpload = file;
        if (isAvatarBucket) {
          setCompressing(true);
          toast.loading("Processing your image, please wait...", { id: toastId });
          if (file.size > 500 * 1024) {
            toast.info("Image is too large. We're compressing it automatically...", { duration: 4000 });
          }
          try {
            fileToUpload = await compressAndConvertImage(file);
          } finally {
            setCompressing(false);
            toast.dismiss(toastId);
          }
        }

        const ext = isAvatarBucket ? "jpg" : fileToUpload.name.split(".").pop() || "";
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const filePath = `${prefix}${fileName}`;

        const { data, error } = await db.storage.from(bucket).upload(filePath, fileToUpload);
        if (error) {
          const raw = (error as { message?: string }).message || "";
          const low = raw.toLowerCase();
          if (low.includes("failed to fetch") || low.includes("network")) {
            throw new Error("Upload failed. Please check your internet connection and try again.");
          }
          throw new Error(raw || "Upload failed. Please check your internet connection and try again.");
        }
        const url = data?.url ?? "";
        results.push({
          id: data?.path ?? filePath,
          url,
          name: file.name,
          size: fileToUpload.size,
          type: fileToUpload.type,
        });
        done += 1;
        setUploadProgress(Math.round((done / total) * 100));
      }

      toast.success(`${results.length} file(s) uploaded successfully`);
      setDialogOpen(false);
      setPendingFiles([]);
      onUploadComplete(results);
    } catch (err) {
      let message =
        err instanceof Error
          ? err.message
          : "Upload failed. Please check your internet connection and try again.";
      const low = message.toLowerCase();
      if (low.includes("failed to fetch") || low.includes("networkerror")) {
        message = "Upload failed. Please check your internet connection and try again.";
      }
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
      setCompressing(false);
      setUploadProgress(0);
      toast.dismiss(toastId);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple={multiple}
        accept={accept}
        capture={inputCapture}
        onChange={handleInputChange}
      />
      {!hideButton && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={openPicker}
        >
          <Upload className="w-4 h-4" />
          {label}
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review Files Before Uploading</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {pendingFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No files selected</p>
            ) : (
              <ul className="space-y-2 max-h-60 overflow-auto">
                {pendingFiles.map((file, index) => {
                  const Icon = getFileIcon(file.type);
                  return (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border"
                    >
                      <div className="w-8 h-8 rounded flex items-center justify-center bg-background">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8"
                        onClick={() => removePending(index)}
                        disabled={uploading || compressing}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}

            {pendingFiles.length > 0 && (
              <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={addMore} disabled={uploading || compressing}>
                <Plus className="w-4 h-4" />
                Add More
              </Button>
            )}

            {uploadError && (
              <div className="rounded-lg bg-destructive/10 text-destructive text-sm p-3">
                {uploadError}
              </div>
            )}

            {(uploading || compressing) && (
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {compressing ? "Processing your image, please wait…" : "Uploading…"}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={uploading || compressing}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={performUpload}
              disabled={pendingFiles.length === 0 || uploading || compressing}
            >
              {uploading || compressing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                `Upload ${pendingFiles.length} file(s)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
