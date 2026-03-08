import { supabase } from "@/integrations/supabase/client";

export async function uploadToStorage(bucket: string, path: string, file: Blob | File) {
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;
}
