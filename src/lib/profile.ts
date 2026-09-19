import * as FileSystemLegacy from "expo-file-system/legacy";

import { supabase } from "@/src/lib/supabase";

export type ProfileGender = "male" | "female" | "unspecified";

export type EditableProfile = {
  first_name: string;
  last_name: string;
  gender: ProfileGender;
  age_years: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  avatar_url: string | null;
};

type AvatarAsset = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
};

const MAX_AVATAR_BYTES = 6 * 1024 * 1024;

async function currentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.user) throw new Error("Session expirée. Reconnecte-toi.");
  return data.session;
}

export async function uploadMyAvatar(asset: AvatarAsset) {
  if (asset.fileSize != null && asset.fileSize > MAX_AVATAR_BYTES) {
    throw new Error("La photo dépasse la taille maximale autorisée (6 Mo).");
  }

  const session = await currentSession();
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Configuration Supabase absente.");
  }

  const mimeType = asset.mimeType?.startsWith("image/")
    ? asset.mimeType
    : "image/jpeg";
  const rawExtension =
    asset.fileName?.split(".").pop()?.toLowerCase() ??
    mimeType.split("/").pop() ??
    "jpg";
  const extension = /^[a-z0-9]+$/.test(rawExtension) ? rawExtension : "jpg";
  const path = `${session.user.id}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}.${extension}`;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");

  const upload = await FileSystemLegacy.uploadAsync(
    `${supabaseUrl}/storage/v1/object/avatars/${encodedPath}`,
    asset.uri,
    {
      httpMethod: "POST",
      uploadType: FileSystemLegacy.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: supabaseKey,
        "Content-Type": mimeType,
        "x-upsert": "false",
        "cache-control": "max-age=3600",
      },
    }
  );

  if (upload.status < 200 || upload.status >= 300) {
    throw new Error(`Impossible d'envoyer la photo (${upload.status}).`);
  }

  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

export async function updateMyProfile(input: EditableProfile) {
  const session = await currentSession();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.user.id)
    .select(
      "id, role, first_name, last_name, avatar_url, gender, age_years, height_cm, weight_kg"
    )
    .single();

  if (error) throw error;
  return data;
}
