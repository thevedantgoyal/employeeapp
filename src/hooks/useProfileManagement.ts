import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/api/db";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

  const uploadAvatar = async (file: File): Promise<string | null> => {
    if (!user) throw new Error("Not authenticated");
    validateImageFile(file);
    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `avatar-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await db.storage
        .from("avatars")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = db.storage.from("avatars").getPublicUrl(filePath);
      return data.publicUrl;
    } finally {
      setUploading(false);
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

  return { uploadAvatar, uploadResume, uploading };
};

function validateImageFile(file: File) {
  const allowed = ["image/jpeg", "image/png"];
  if (!allowed.includes(file.type)) {
    throw new Error("Only JPEG and PNG images are allowed");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be less than 5MB");
  }
}

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
