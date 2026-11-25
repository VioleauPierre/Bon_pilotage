"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminAuthClient, allowAdminLogin, requireAdmin } from "@/lib/admin-auth";
import { getBonPilotageTableName, getSupabaseAdminClient } from "@/lib/supabase";
import { filterParams, getAdminHref, parseAdminFilters } from "@/lib/admin-filters";
import { getMailConfiguration } from "@/lib/admin-settings";

const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(256),
});

export async function signIn(_previous: string, form: FormData): Promise<string> {
  const credentials = loginSchema.safeParse({
    email: String(form.get("email") ?? "").trim(),
    password: form.get("password"),
  });

  if (!credentials.success) return "Identifiants invalides.";
  const allowedId = process.env.ADMIN_SUPABASE_USER_ID?.trim().toLowerCase();
  const client = await adminAuthClient();
  if (!client || !allowedId) return "Connexion indisponible.";

  try {
    if (!(await allowAdminLogin())) return "Trop de tentatives. Réessayez dans quelques minutes.";
    const { data, error } = await client.auth.signInWithPassword(credentials.data);
    if (error?.status === 429) return "Trop de tentatives. Réessayez dans quelques minutes.";
    if (error || !data.user) return "Identifiants invalides.";
    if (data.user.id !== allowedId) {
      await client.auth.signOut({ scope: "local" });
      return "Identifiants invalides.";
    }
  } catch {
    console.error("Admin login unavailable");
    return "Connexion indisponible. Réessayez dans quelques minutes.";
  }

  redirect("/admin");
}

export async function signOut() {
  const { client } = await requireAdmin();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) redirect("/admin?notice=sign-out");
  redirect("/admin");
}

export async function revokeOtherSessions() {
  const { client } = await requireAdmin();
  const { error } = await client.auth.signOut({ scope: "others" });
  redirect(error ? "/admin?notice=revoke-error" : "/admin?notice=revoked");
}

export async function changeSubmission(form: FormData) {
  await requireAdmin();
  const id = z.uuid().safeParse(form.get("id"));
  const operation = form.get("operation");
  const search = new URLSearchParams(String(form.get("filters") ?? "").slice(0, 1400));
  const filters = parseAdminFilters(search);
  const back = getAdminHref(filters);
  if (!id.success) redirect(back);

  const table = getSupabaseAdminClient().from(getBonPilotageTableName());
  switch (operation) {
    case "open": {
      const { error } = await table
        .update({ viewed_at: new Date().toISOString() }).eq("id", id.data).is("viewed_at", null);
      if (error) redirect(getAdminHref(filters, "update"));
      revalidatePath("/admin");
      redirect(`/admin/bons/${id.data}?${filterParams(filters)}`);
    }
    case "unread":
    case "invoice":
    case "uninvoice": {
      const values = operation === "unread"
        ? { viewed_at: null }
        : { invoiced: operation === "invoice" };
      const { error } = await table.update(values).eq("id", id.data);
      if (error) redirect(getAdminHref(filters, "update"));
      revalidatePath("/admin");
      redirect(back);
    }
    default:
      redirect(back);
  }
}

export async function changeMailSetting(form: FormData) {
  await requireAdmin();
  const enabled = form.get("enabled") === "true";
  if (enabled && !getMailConfiguration()) redirect("/admin?notice=mail-config");
  const { error } = await getSupabaseAdminClient().from("bon_pilotage_admin_settings")
    .update({ send_email: enabled }).eq("id", true).select("id").single();
  revalidatePath("/admin");
  redirect(error ? "/admin?notice=update" : "/admin?notice=mail-saved");
}
