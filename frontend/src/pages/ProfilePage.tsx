import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Mail, Phone, Link as LinkIcon, ExternalLink, ChevronRight,
  MapPin, Building2, Briefcase, Edit2, Save, X, Camera, FileText,
  Calendar, AlignLeft, Loader2, Circle, Coffee, EyeOff, ImagePlus,
} from "lucide-react";
import { ConnectPlusLoader } from "@/components/ui/ConnectPlusLoader";
import { useAuth } from "@/contexts/AuthContext";
import { PushNotificationToggle } from "@/components/notifications/PushNotificationToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

import { WorkingStatusSelector } from "@/components/profile/WorkingStatusSelector";
import { ManagerCard } from "@/components/profile/ManagerCard";
import {
  useExtendedProfile,
  useUpdateProfile,
  useProfileFileUpload,
  type ExtendedProfile,
} from "@/hooks/useProfileManagement";
import { toast } from "sonner";
import { formatIndiaMobileInput, normalizeProfilePhoneForEdit, isValidIndiaMobileDisplay } from "@/lib/utils";
import { FileUploader, type FileUploaderRef, type UploadedFileInfo } from "@/components/upload/FileUploader";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

/** Derive display type from profile for Team & Hierarchy / Organisation Role sections. */
function getUserType(profile: ExtendedProfile | null | undefined): "EMPLOYEE" | "MANAGER" | "SENIOR_MANAGER" {
  if (!profile) return "EMPLOYEE";
  const role = profile.external_role;
  const subRole = profile.external_sub_role;
  if (role === "subadmin" || (role === "manager" && subRole)) return "SENIOR_MANAGER";
  if (role === "manager") return "MANAGER";
  return "EMPLOYEE";
}

const STATUS_INDICATORS: Record<string, { color: string; label: string }> = {
  available: { color: "bg-emerald-500", label: "Available" },
  busy: { color: "bg-red-500", label: "Busy" },
  brb: { color: "bg-amber-500", label: "Be Right Back" },
  offline: { color: "bg-muted-foreground", label: "Appear Offline" },
};

type ProfileEditData = {
  phone: string;
  bio: string;
  linkedin_url: string;
  joining_date: string;
  job_title: string;
  location: string;
  department: string;
};

const ProfilePage = () => {
  const { user } = useAuth();
  const { data: profile, isLoading } = useExtendedProfile();
  const userType = getUserType(profile);
  console.log("[TeamHierarchy] getUserType(profile):", userType);
  const updateProfile = useUpdateProfile();
  const { uploadAvatar, uploadResume, uploading } = useProfileFileUpload();

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<ProfileEditData>({
    phone: "",
    bio: "",
    linkedin_url: "",
    joining_date: "",
    job_title: "",
    location: "",
    department: "",
  });
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const avatarUploaderRef = useRef<FileUploaderRef>(null);
  const resumeUploaderRef = useRef<FileUploaderRef>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Manager state
  const [manager, setManager] = useState<{ full_name: string; job_title: string | null; avatar_url: string | null } | null>(null);

  // Fetch reporting manager for both EMPLOYEE and MANAGER when profile.manager_id is set (from profiles table).
  useEffect(() => {
    const managerIdFromProfiles = profile?.manager_id ?? null;
    console.log("[TeamHierarchy] current user external_role:", profile?.external_role);
    console.log("[TeamHierarchy] manager_id from profile:", managerIdFromProfiles);
    console.log("[TeamHierarchy] resolved manager:", manager);

    if (!managerIdFromProfiles) {
      setManager(null);
      return;
    }

    import("@/integrations/api/db").then(({ db }) => {
      db
        .from("profiles")
        .select("full_name, job_title, avatar_url")
        .eq("id", managerIdFromProfiles)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.warn("[Profile] manager fetch error:", error);
            setManager(null);
            return;
          }
          if (data && typeof data === "object" && "full_name" in data) {
            const resolved = {
              full_name: String((data as { full_name?: string }).full_name ?? ""),
              job_title: (data as { job_title?: string | null }).job_title ?? null,
              avatar_url: (data as { avatar_url?: string | null }).avatar_url ?? null,
            };
            console.log("[TeamHierarchy] resolved manager:", resolved);
            setManager(resolved);
          } else {
            setManager(null);
          }
        });
    });
  }, [profile?.manager_id]);

  const startEditing = () => {
    if (!profile) return;
    setEditData({
      phone: normalizeProfilePhoneForEdit(profile.phone),
      bio: String(profile.bio ?? ""),
      linkedin_url: String(profile.linkedin_url ?? ""),
      joining_date: String(profile.joining_date ?? ""),
      job_title: String(profile.job_title ?? ""),
      location: String(profile.location ?? ""),
      department: String(profile.department ?? ""),
    });
    setEditing(true);
  };

  const handleSave = async () => {
    const p = editData.phone.trim();
    if (p.startsWith("+91") && !isValidIndiaMobileDisplay(editData.phone)) {
      toast.error("Enter a valid 10-digit Indian mobile number");
      return;
    }
    try {
      await updateProfile.mutateAsync(editData as Partial<ExtendedProfile>);
      setEditing(false);
    } catch {
      // handled by mutation
    }
  };

  const onAvatarUploadComplete = (files: UploadedFileInfo[]) => {
    const f = files[0];
    if (f) updateProfile.mutateAsync({ avatar_url: f.url });
  };

  const onResumeUploadComplete = (files: UploadedFileInfo[]) => {
    const f = files[0];
    if (f) updateProfile.mutateAsync({ resume_url: f.url });
  };

  // Camera stream for Take Photo
  useEffect(() => {
    if (!cameraOpen) return;
    setCameraError(null);
    let stream: MediaStream | null = null;
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) {
        setCameraError("Camera access denied or unavailable.");
      }
    };
    start();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cameraOpen]);

  const handleCapturePhoto = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    setCapturing(true);
    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
      if (!blob) return;
      const file = new File([blob], `avatar-${Date.now()}.jpg`, { type: "image/jpeg" });
      const url = await uploadAvatar(file);
      if (url) {
        await updateProfile.mutateAsync({ avatar_url: url });
        setCameraOpen(false);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save photo");
    } finally {
      setCapturing(false);
    }
  }, [uploadAvatar, updateProfile]);

  if (isLoading) {
    return <ConnectPlusLoader variant="inline" message="Loading profile..." />;
  }

  const statusInfo = STATUS_INDICATORS[profile?.working_status || "available"] || STATUS_INDICATORS.available;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Profile Header */}
      <motion.div variants={itemVariants} className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <span />
          {editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="w-4 h-4" /></Button>
              <Button size="sm" onClick={handleSave} disabled={updateProfile.isPending}>
                {updateProfile.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={startEditing}><Edit2 className="w-4 h-4" /></Button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="w-20 h-20 rounded-full overflow-hidden bg-accent ring-4 ring-background shadow-elevated cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {profile?.avatar_url?.trim() ? (
                    <img src={profile.avatar_url.trim()} alt={profile.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/10">
                      <span className="text-2xl font-display font-bold text-primary">
                        {profile?.full_name?.charAt(0).toUpperCase() || "?"}
                      </span>
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-full">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8}>
                <DropdownMenuItem onClick={() => setCameraOpen(true)}>
                  <Camera className="mr-2 h-4 w-4" />
                  Take Photo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => avatarUploaderRef.current?.openPicker()}>
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Select from Device
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className={`absolute bottom-0 right-0 w-4 h-4 rounded-full ${statusInfo.color} border-2 border-card`} />
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
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-display font-bold">{profile?.full_name || "User"}</h2>
            {editing ? (
              <Input value={editData.job_title} onChange={(e) => setEditData({ ...editData, job_title: e.target.value })}
                placeholder="Job Title" className="mt-1 h-8 text-sm" />
            ) : (
              <p className="text-primary font-medium text-sm">{profile?.job_title || "Employee"}</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
              {editing ? (
                <>
                  <Input value={editData.department} onChange={(e) => setEditData({ ...editData, department: e.target.value })}
                    placeholder="Department" className="h-7 text-xs w-28" />
                  <Input value={editData.location} onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                    placeholder="Location" className="h-7 text-xs w-28" />
                </>
              ) : (
                <>
                  {profile?.department && (
                    <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{profile.department}</span>
                  )}
                  {profile?.location && (
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{profile.location}</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Working Status */}
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Working Status</p>
          <WorkingStatusSelector currentStatus={profile?.working_status || "available"} />
        </div>
      </motion.div>

      {/* Bio */}
      {(profile?.bio || editing) && (
        <motion.section variants={itemVariants}>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">About</h3>
          <div className="bg-card rounded-2xl p-4 shadow-soft border border-border/50">
            {editing ? (
              <Textarea value={editData.bio} onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                placeholder="Tell your team about yourself..." maxLength={500} rows={3} />
            ) : (
              <p className="text-sm text-foreground/80">{profile?.bio}</p>
            )}
          </div>
        </motion.section>
      )}

      {/* Contact Information */}
      <motion.section variants={itemVariants}>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">Contact Information</h3>
        <div className="bg-card rounded-2xl divide-y divide-border shadow-soft border border-border/50 overflow-hidden">
          <div className="flex items-center gap-4 p-4">
            <div className="p-2 bg-primary/10 rounded-xl"><Mail className="w-5 h-5 text-primary" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Work Email</p>
              <p className="font-medium truncate">{profile?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4">
            <div className="p-2 bg-primary/10 rounded-xl"><Phone className="w-5 h-5 text-primary" /></div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Mobile</p>
              {editing ? (
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={editData.phone}
                  onChange={(e) => {
                    const v = e.target.value;
                    const useIndia =
                      editData.phone.trim() === "" ||
                      editData.phone.startsWith("+91") ||
                      v.startsWith("+91");
                    setEditData({
                      ...editData,
                      phone: useIndia ? formatIndiaMobileInput(v) : v,
                    });
                  }}
                  placeholder="+91 XXXXX XXXXX"
                  className="h-8 text-sm mt-0.5 placeholder:text-muted-foreground/60"
                />
              ) : (
                <p className="font-medium">{profile?.phone || "Not set"}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 p-4">
            <div className="p-2 bg-primary/10 rounded-xl"><LinkIcon className="w-5 h-5 text-primary" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">LinkedIn</p>
              {editing ? (
                <Input value={editData.linkedin_url} onChange={(e) => setEditData({ ...editData, linkedin_url: e.target.value })}
                  placeholder="LinkedIn URL" className="h-8 text-sm mt-0.5" />
              ) : profile?.linkedin_url ? (
                <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer"
                  className="font-medium truncate block text-primary hover:underline">{profile.linkedin_url}</a>
              ) : (
                <p className="font-medium text-muted-foreground">Not set</p>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Joining Date & Resume */}
      <motion.section variants={itemVariants}>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">Work Details</h3>
        <div className="bg-card rounded-2xl divide-y divide-border shadow-soft border border-border/50 overflow-hidden">
          <div className="flex items-center gap-4 p-4">
            <div className="p-2 bg-primary/10 rounded-xl"><Calendar className="w-5 h-5 text-primary" /></div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Joining Date</p>
              {editing ? (
                <Input type="date" value={editData.joining_date}
                  onChange={(e) => setEditData({ ...editData, joining_date: e.target.value })}
                  className="h-8 text-sm mt-0.5" />
              ) : (
                <p className="font-medium">
                  {profile?.joining_date ? new Date(profile.joining_date).toLocaleDateString() : "Not set"}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => resumeUploaderRef.current?.openPicker()}>
            <div className="p-2 bg-primary/10 rounded-xl"><FileText className="w-5 h-5 text-primary" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Resume</p>
              {profile?.resume_url ? (
                <a href={profile.resume_url} target="_blank" rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline text-sm" onClick={(e) => e.stopPropagation()}>
                  View Resume
                </a>
              ) : (
                <p className="font-medium text-muted-foreground text-sm">Tap to upload</p>
              )}
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
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
          </div>
        </div>
      </motion.section>

      {/* Team & Hierarchy (EMPLOYEE / MANAGER) or Organisation Role (SENIOR_MANAGER) */}
      <motion.section variants={itemVariants}>
        {userType === "SENIOR_MANAGER" ? (
          <>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">Organisation Role</h3>
            <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
              <div className="flex items-center gap-4 p-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {profile?.external_sub_role || "Senior Management"}
                  </p>
                  <p className="text-sm text-muted-foreground">Senior Management</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Reports to no one · Top of reporting chain
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">Team & Hierarchy</h3>
            <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
              {manager ? (
                <ManagerCard
                  full_name={manager.full_name}
                  job_title={manager.job_title}
                  avatar_url={manager.avatar_url}
                />
              ) : (
                <div className="p-6 text-center">
                  <Briefcase className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No manager assigned</p>
                </div>
              )}
            </div>
          </>
        )}
      </motion.section>

      {/* Notification Settings */}
      <motion.section variants={itemVariants}>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">Notification Settings</h3>
        <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
          <PushNotificationToggle />
        </div>
      </motion.section>

      {/* Take Photo dialog */}
      <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Take profile photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative aspect-[4/3] bg-muted rounded-xl overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            {cameraError && (
              <p className="text-sm text-destructive">{cameraError}</p>
            )}
            <Button
              className="w-full"
              onClick={handleCapturePhoto}
              disabled={!!cameraError || capturing}
            >
              {capturing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Camera className="w-4 h-4 mr-2" />
              )}
              {capturing ? "Saving..." : "Capture & Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default ProfilePage;
