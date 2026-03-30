import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import heic2any from "heic2any";
import { db } from "@/integrations/api/db";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const READ_TIMEOUT_MS = 10_000;

function readFileAsDataURLWithTimeout(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const t = setTimeout(() => {
      try {
        reader.abort();
      } catch {
        /* ignore */
      }
      reject(new Error("Upload taking too long, please try a smaller image."));
    }, READ_TIMEOUT_MS);
    reader.onerror = () => {
      clearTimeout(t);
      reject(new Error("Could not read file"));
    };
    reader.onload = (e) => {
      clearTimeout(t);
      const r = e.target?.result;
      if (typeof r !== "string") {
        reject(new Error("Could not read file"));
        return;
      }
      resolve(r);
    };
    reader.readAsDataURL(blob);
  });
}

/** Common image extensions when MIME is missing or wrong (e.g. mobile uploads). */
const IMAGE_FILENAME_EXT =
  /\.(jpe?g|png|gif|webp|bmp|tiff?|ico|svg|heic|heif|avif|jfif|pjpeg|pjp|psd|cr2|nef|arw|dng|raw)$/i;

function assertLikelyImageFile(file: File): void {
  const lower = file.name.toLowerCase();
  if (file.type.startsWith("image/")) return;
  if (file.type === "application/octet-stream" && IMAGE_FILENAME_EXT.test(lower)) return;
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return;
  if (IMAGE_FILENAME_EXT.test(lower)) return;
  throw new Error(
    "This file format is not supported. Please use a standard image or photo file.",
  );
}

function mapCompressError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes("too long")) return err.message;
    if (
      err.message.includes("Could not read") ||
      err.message.includes("Could not load") ||
      err.message.includes("Compression failed")
    ) {
      return "This file format is not supported. Please use a standard image or photo file.";
    }
    return err.message;
  }
  return "This file format is not supported. Please use a standard image or photo file.";
}

/**
 * Resize (max side 1200px), convert to JPEG 0.85. HEIC/HEIF handled via heic2any first.
 */
export async function compressAndConvertImage(file: File): Promise<File> {
  try {
    assertLikelyImageFile(file);
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }

  let blob: Blob = file;

  const lower = file.name.toLowerCase();
  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    lower.endsWith(".heic") ||
    lower.endsWith(".heif");

  if (isHeic) {
    try {
      const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
      blob = Array.isArray(converted) ? converted[0] : converted;
    } catch {
      throw new Error("This file format is not supported. Please use a standard image or photo file.");
    }
  }

  try {
    const dataUrl = await readFileAsDataURLWithTimeout(blob);
    return await new Promise<File>((resolve, reject) => {
      const img = new Image();
      img.onerror = () =>
        reject(new Error("This file format is not supported. Please use a standard image or photo file."));
      img.onload = () => {
        try {
          const MAX = 1200;
          let w = img.width;
          let h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) {
              h = Math.round((h * MAX) / w);
              w = MAX;
            } else {
              w = Math.round((w * MAX) / h);
              h = MAX;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Compression failed"));
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            (out) => {
              if (!out) {
                reject(new Error("Compression failed"));
                return;
              }
              resolve(new File([out], "profile.jpg", { type: "image/jpeg" }));
            },
            "image/jpeg",
            0.85,
          );
        } catch (e) {
          reject(e instanceof Error ? e : new Error("Compression failed"));
        }
      };
      img.src = dataUrl;
    });
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error("Could not process image");
  }
}

export interface ExtendedProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  job_title: string | null;
  department: string | null;
  location: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: string | null;
  work_hours: string | null;
  linkedin_url: string | null;
  bio: string | null;
  resume_url: string | null;
  joining_date: string | null;
  other_social_links: Record<string, string> | null;
  working_status: string;
  profile_completed: boolean;
  manager_id: string | null;
  external_role?: string | null;
  external_sub_role?: string | null;
}

export const useExtendedProfile = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["extended-profile", user?.id],
    queryFn: async (): Promise<ExtendedProfile | null> => {
      if (!user) return null;
      const { data, error } = await db
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data as unknown as ExtendedProfile;
    },
    enabled: !!user,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<ExtendedProfile>) => {
      if (!user) throw new Error("Not authenticated");
      // Remove fields that shouldn't be updated
      const { id, user_id, email, ...safeUpdates } = updates as Partial<ExtendedProfile> & Record<string, unknown>;
      const { data, error } = await db
        .from("profiles")
        .update(safeUpdates)
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["extended-profile"] });
      toast.success("Profile updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update profile: " + error.message);
    },
  });
};

export const useCompleteProfile = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (profileData: {
      phone?: string;
      bio?: string;
      linkedin_url?: string;
      joining_date?: string;
      other_social_links?: Record<string, string>;
      avatar_url?: string;
      resume_url?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const updatePayload: Record<string, unknown> = {
        profile_completed: true,
      };
      if (profileData.phone) updatePayload.phone = profileData.phone;
      if (profileData.bio) updatePayload.bio = profileData.bio;
      if (profileData.linkedin_url) updatePayload.linkedin_url = profileData.linkedin_url;
      if (profileData.joining_date) updatePayload.joining_date = profileData.joining_date;
      if (profileData.avatar_url) updatePayload.avatar_url = profileData.avatar_url;
      if (profileData.resume_url) updatePayload.resume_url = profileData.resume_url;
      if (profileData.other_social_links) updatePayload.other_social_links = profileData.other_social_links;

      const { data, error } = await db
        .from("profiles")
        .update(updatePayload as Record<string, unknown>)
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["extended-profile"] });
      toast.success("Profile completed successfully!");
    },
    onError: (error: Error) => {
      toast.error("Failed to complete profile: " + error.message);
    },
  });
};

export const useUpdateWorkingStatus = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (status: string) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await db
        .from("profiles")
        .update({ working_status: status })
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["extended-profile"] });
    },
  });
};

export const useProfileFileUpload = () => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);

  const uploadAvatar = async (file: File): Promise<string | null> => {
    if (!user) throw new Error("Not authenticated");
    const toastId = "avatar-upload";
    toast.loading("Processing your image, please wait...", { id: toastId });

    if (file.size > 500 * 1024) {
      toast.info("Image is too large. We're compressing it automatically...", { duration: 4000 });
    }

    setCompressing(true);
    let processed: File;
    try {
      processed = await compressAndConvertImage(file);
    } catch (err) {
      toast.dismiss(toastId);
      setCompressing(false);
      const msg = mapCompressError(err);
      toast.error(msg);
      throw new Error(msg);
    }
    setCompressing(false);

    setUploading(true);
    try {
      const fileName = `avatar-${Date.now()}.jpg`;
      const filePath = `${user.id}/${fileName}`;

      const { data, error: uploadError } = await db.storage
        .from("avatars")
        .upload(filePath, processed);
      if (uploadError) {
        const raw = String((uploadError as { message?: string }).message || "");
        const low = raw.toLowerCase();
        if (low.includes("failed to fetch") || low.includes("network")) {
          throw new Error("Upload failed. Please check your internet connection and try again.");
        }
        throw new Error(
          raw || "Upload failed. Please check your internet connection and try again.",
        );
      }
      toast.dismiss(toastId);
      if (data?.url) return data.url;
      const pub = db.storage.from("avatars").getPublicUrl(filePath);
      return pub.data.publicUrl;
    } catch (err) {
      let msg =
        err instanceof Error
          ? err.message
          : "Upload failed. Please check your internet connection and try again.";
      const low = msg.toLowerCase();
      if (
        low.includes("failed to fetch") ||
        low.includes("networkerror") ||
        low.includes("network request failed")
      ) {
        msg = "Upload failed. Please check your internet connection and try again.";
      }
      toast.error(msg);
      throw new Error(msg);
    } finally {
      setUploading(false);
      toast.dismiss(toastId);
    }
  };

  const uploadResume = async (file: File): Promise<string | null> => {
    if (!user) throw new Error("Not authenticated");
    validateResumeFile(file);
    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `resume-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await db.storage
        .from("resumes")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = db.storage.from("resumes").getPublicUrl(filePath);
      return data.publicUrl;
    } finally {
      setUploading(false);
    }
  };

  return { uploadAvatar, uploadResume, uploading: uploading || compressing };
};

function validateResumeFile(file: File) {
  const allowed = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowed.includes(file.type)) {
    throw new Error("Only PDF and DOC/DOCX files are allowed");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Resume must be less than 10MB");
  }
}
