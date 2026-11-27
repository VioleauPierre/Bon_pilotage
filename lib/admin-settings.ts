import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getSendEmailSetting(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("bon_pilotage_admin_settings")
    .select("send_email").eq("id", true).single();
  if (error || typeof data?.send_email !== "boolean") {
    throw new Error("Paramètre d’envoi indisponible");
  }
  return data.send_email as boolean;
}

export function getMailConfiguration() {
  const recipient = process.env.NOTIFICATION_EMAIL?.trim();
  if (!recipient || !process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  return { recipient };
}
