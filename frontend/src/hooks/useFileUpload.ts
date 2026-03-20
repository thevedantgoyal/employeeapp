import { useState } from "react";
import { db } from "@/integrations/api/db";
import { useAuth } from "@/contexts/AuthContext";

export const useFileUpload = () => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!user) throw new Error("Not authenticated");

    setUploading(true);
    setProgress(0);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await db.storage
        .from("evidence")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Return the file path for storage in DB; generate signed URLs at read time
      setProgress(100);
      return filePath;
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (url: string): Promise<void> => {
    if (!user) throw new Error("Not authenticated");

    // Extract file path from URL
    const urlParts = url.split("/evidence/");
    if (urlParts.length < 2) return;

    const filePath = urlParts[1];

    const { error } = await db.storage.from("evidence").remove([filePath]);

    if (error) throw error;
  };

  return {
    uploadFile,
    deleteFile,
    uploading,
    progress,
  };
};
