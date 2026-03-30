import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/api/db";
import { motion } from "framer-motion";
import {
  Camera,
  Phone,
  FileText,
  LinkIcon,
  Calendar,
  AlignLeft,
  Upload,
  Loader2,
  CheckCircle2,
  Plus,
  X,
  ImagePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCompleteProfile, useProfileFileUpload } from "@/hooks/useProfileManagement";
import { useExtendedProfile } from "@/hooks/useProfileManagement";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/api/client";
import { toast } from "sonner";
import { FileUploader, type FileUploaderRef, type UploadedFileInfo } from "@/components/upload/FileUploader";
import {
  IN_PHONE_PREFIX,
  formatIndiaMobileInput,
  isValidIndiaMobileDisplay,
} from "@/lib/utils";

const SKILL_SUGGESTIONS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  "Python",
  "SQL",
  "Project Management",
  "Data Analysis",
  "UI/UX Design",
  "DevOps",
  "Communication",
  "Leadership",
  "Problem Solving",
  "Agile",
];

const CompleteProfilePage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, refreshSession } = useAuth();
  const { data: profile } = useExtendedProfile();
  const completeProfile = useCompleteProfile();
  const { uploadAvatar, uploadResume, uploading } = useProfileFileUpload();

  const avatarUploaderRef = useRef<FileUploaderRef>(null);
  const resumeUploaderRef = useRef<FileUploaderRef>(null);
  const avatarBlobUrlRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedBlobUrl, setCapturedBlobUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeName, setResumeName] = useState<string | null>(null);
  const [phone, setPhone] = useState(IN_PHONE_PREFIX);
  const [bio, setBio] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (avatarBlobUrlRef.current) {
        URL.revokeObjectURL(avatarBlobUrlRef.current);
        avatarBlobUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!cameraOpen) return;
    setCameraError(null);
    setCapturedBlobUrl(null);
    setCapturedFile(null);
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((s) => {
        stream = s;
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((err: unknown) => {
        setCameraError(err instanceof Error ? err.message : "Camera access denied");
        toast.error("Could not access camera");
      });
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [cameraOpen]);

  const handleCapturePhoto = () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (video.srcObject) video.srcObject = null;
        const file = new File([blob], `avatar-${Date.now()}.jpg`, { type: "image/jpeg" });
        setCapturedFile(file);
        setCapturedBlobUrl(URL.createObjectURL(blob));
      },
      "image/jpeg",
      0.9
    );
  };

  const handleConfirmCapture = async () => {
    if (!capturedFile) return;
    const prevPreview = avatarPreview;
    const prevUrl = avatarUrl;
    if (avatarBlobUrlRef.current) {
      URL.revokeObjectURL(avatarBlobUrlRef.current);
      avatarBlobUrlRef.current = null;
    }
    const blobUrl = capturedBlobUrl ?? URL.createObjectURL(capturedFile);
    avatarBlobUrlRef.current = blobUrl;
    setAvatarPreview(blobUrl);
    try {
      const url = await uploadAvatar(capturedFile);
      if (url) {
        setAvatarUrl(url);
        setAvatarPreview(url);
        if (avatarBlobUrlRef.current) {
          URL.revokeObjectURL(avatarBlobUrlRef.current);
          avatarBlobUrlRef.current = null;
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setAvatarPreview(prevPreview);
      setAvatarUrl(prevUrl);
      if (avatarBlobUrlRef.current) {
        URL.revokeObjectURL(avatarBlobUrlRef.current);
        avatarBlobUrlRef.current = null;
      }
    }
    if (capturedBlobUrl) URL.revokeObjectURL(capturedBlobUrl);
    setCapturedBlobUrl(null);
    setCapturedFile(null);
    setCameraOpen(false);
  };

  const handleRetakeCapture = () => {
    if (capturedBlobUrl) URL.revokeObjectURL(capturedBlobUrl);
    setCapturedBlobUrl(null);
    setCapturedFile(null);
    setCameraError(null);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((s) => {
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((err: unknown) => {
        setCameraError(err instanceof Error ? err.message : "Camera access denied");
      });
  };

  const onAvatarUploadComplete = (files: UploadedFileInfo[]) => {
    const f = files[0];
    if (!f) return;
    if (avatarBlobUrlRef.current) {
      URL.revokeObjectURL(avatarBlobUrlRef.current);
      avatarBlobUrlRef.current = null;
    }
    setAvatarUrl(f.url);
    setAvatarPreview(f.url);
  };

  const onResumeUploadComplete = (files: UploadedFileInfo[]) => {
    const f = files[0];
    if (f) {
      setResumeUrl(f.url);
      setResumeName(f.name);
    }
  };

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !skills.includes(trimmed) && skills.length < 20) {
      setSkills([...skills, trimmed]);
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!isValidIndiaMobileDisplay(phone)) {
      toast.error("Enter a valid 10-digit Indian mobile number");
      return;
    }
    if (!bio.trim()) {
      toast.error("Short bio is required");
      return;
    }
    if (skills.length === 0) {
      toast.error("Please add at least one skill");
      return;
    }
    if (!joiningDate) {
      toast.error("Joining date is required");
      return;
    }
    if (!avatarUrl) {
      toast.error("Profile picture is required");
      return;
    }

    setSubmitting(true);
    try {
      // Save profile data (sets profile_completed: true)
      await completeProfile.mutateAsync({
        phone,
        bio,
        linkedin_url: linkedinUrl || undefined,
        joining_date: joiningDate,
        avatar_url: avatarUrl,
        resume_url: resumeUrl || undefined,
        other_social_links: { ...socialLinks, skills: skills.join(",") },
      });

      // Save skills to skills table (same user.id as Skills section uses for fetch)
      if (user && skills.length > 0) {
        try {
          for (const name of skills) {
            const { error: skillsError } = await db.from("skills").insert({
              user_id: user.id,
              name,
              proficiency_level: 1,
              goal_level: 5,
            });
            if (skillsError) console.error("Failed to save skill:", name, skillsError);
          }
        } catch (skillsErr) {
          console.error("Skills save error:", skillsErr);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["extended-profile"] });
      queryClient.invalidateQueries({ queryKey: ["skills"] });

      // Mark onboarding complete (first_login = false) so user goes to dashboard on next load
      await api.post("/auth/complete-onboarding");
      await refreshSession();

      // Redirect to dashboard
      navigate("/", { replace: true });
    } catch {
      // Error handled by mutation (toast from useCompleteProfile onError)
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto flex items-center justify-center px-4 h-14">
          <h1 className="text-base font-display font-semibold">Complete Your Profile</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-muted-foreground text-sm text-center mb-6">
            Complete all required fields (<span className="text-destructive">*</span>) to get started with ConnectPlus.
          </p>
        </motion.div>

        {/* Avatar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex flex-col items-center gap-3"
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative w-24 h-24 rounded-full overflow-hidden bg-accent ring-4 ring-background shadow-elevated cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {(avatarPreview || avatarUrl) && String(avatarPreview || avatarUrl).trim() ? (
                  <img src={String(avatarPreview || avatarUrl).trim()} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-primary/10">
                    <Camera className="w-6 h-6 text-primary" />
                    <span className="text-[10px] text-primary mt-0.5">Upload</span>
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" sideOffset={8}>
              <DropdownMenuItem
                onClick={() => {
                  setCameraOpen(true);
                }}
              >
                <Camera className="w-4 h-4 mr-2" />
                Take Photo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => avatarUploaderRef.current?.openPicker()}>
                <ImagePlus className="w-4 h-4 mr-2" />
                Choose from Device
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <FileUploader
            ref={avatarUploaderRef}
            hideButton
            multiple={false}
            allowedTypes={["image/*", ".heic", ".heif", ".avif", ".jfif", ".bmp", ".tif", ".tiff", ".svg"]}
            maxFileSizeMB={50}
            bucket="avatars"
            label="Upload profile picture"
            onUploadComplete={onAvatarUploadComplete}
          />
          <p className="text-xs text-muted-foreground">
            Tap to upload profile picture <span className="text-destructive">*</span>
          </p>
          <Dialog open={cameraOpen} onOpenChange={(open) => { setCameraOpen(open); if (!open) { if (capturedBlobUrl) URL.revokeObjectURL(capturedBlobUrl); setCapturedBlobUrl(null); setCapturedFile(null); } }}>
            <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle>{capturedBlobUrl ? "Confirm photo" : "Take photo"}</DialogTitle>
              </DialogHeader>
              {cameraError ? (
                <p className="text-sm text-destructive">{cameraError}</p>
              ) : capturedBlobUrl ? (
                <div className="space-y-4">
                  <img src={capturedBlobUrl} alt="Preview" className="w-full aspect-square object-cover rounded-lg bg-muted" />
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={handleRetakeCapture}>
                      Retake
                    </Button>
                    <Button type="button" onClick={handleConfirmCapture} disabled={uploading}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full aspect-square object-cover rounded-lg bg-muted"
                  />
                  <div className="flex justify-end">
                    <Button type="button" onClick={handleCapturePhoto}>
                      <Camera className="w-4 h-4 mr-2" />
                      Capture
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* Email (read-only) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-2"
        >
          <Label className="text-sm font-medium">Email</Label>
          <Input value={profile?.email || ""} disabled className="bg-muted" />
        </motion.div>

        {/* Phone */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="space-y-2"
        >
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" /> Phone Number <span className="text-destructive">*</span>
          </Label>
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+91 XXXXX XXXXX"
            value={phone}
            onChange={(e) => setPhone(formatIndiaMobileInput(e.target.value))}
            className="placeholder:text-muted-foreground/60"
          />
        </motion.div>

        {/* Bio */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="space-y-2"
        >
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <AlignLeft className="w-3.5 h-3.5" /> Short Bio <span className="text-destructive">*</span>
          </Label>
          <Textarea
            placeholder="Tell your team a bit about yourself..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            rows={3}
          />
          <p className="text-xs text-muted-foreground text-right">{bio.length}/500</p>
        </motion.div>

        {/* Skills */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="space-y-2"
        >
          <Label className="text-sm font-medium">
            Skills <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="Add a skill..."
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill(skillInput);
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => addSkill(skillInput)}
              disabled={!skillInput.trim()}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="gap-1 pr-1">
                  {skill}
                  <button onClick={() => removeSkill(skill)} className="ml-0.5 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 mt-1">
            {SKILL_SUGGESTIONS.filter((s) => !skills.includes(s))
              .slice(0, 8)
              .map((s) => (
                <button
                  key={s}
                  onClick={() => addSkill(s)}
                  className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:bg-accent transition-colors"
                >
                  + {s}
                </button>
              ))}
          </div>
        </motion.div>

        {/* Joining Date */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="space-y-2"
        >
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Joining Date <span className="text-destructive">*</span>
          </Label>
          <Input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} />
        </motion.div>

        {/* LinkedIn */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-2"
        >
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <LinkIcon className="w-3.5 h-3.5" /> LinkedIn URL
          </Label>
          <Input
            placeholder="https://linkedin.com/in/yourprofile"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
          />
        </motion.div>

        {/* Resume */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="space-y-2"
        >
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Resume
          </Label>
          <div
            onClick={() => resumeUploaderRef.current?.openPicker()}
            className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-border cursor-pointer hover:bg-muted/50 transition-colors"
          >
            {resumeName ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <span className="text-sm truncate flex-1">{resumeName}</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">Upload PDF or DOC (max 10MB)</span>
              </>
            )}
          </div>
          <FileUploader
            ref={resumeUploaderRef}
            hideButton
            multiple={false}
            allowedTypes={["application/pdf", ".doc", ".docx"]}
            maxFileSizeMB={10}
            bucket="resumes"
            label="Upload resume"
            onUploadComplete={onResumeUploadComplete}
          />
        </motion.div>

        {/* Submit */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="pt-4 pb-8"
        >
          <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting || uploading}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Complete Profile
          </Button>
        </motion.div>
      </main>
    </div>
  );
};

export default CompleteProfilePage;
