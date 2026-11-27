"use server";

import { createHash, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { allowAdminLogin, getSecondAdminUserId } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

const invitation = z.object({
  token_hash: z.string().regex(/^[a-zA-Z0-9_-]{32,128}$/),
  type: z.literal("invite"),
});

const invalidInvitation = "Le lien est invalide, expiré ou déjà utilisé. Demandez une nouvelle invitation si nécessaire.";
const unavailable = "Impossible d’enregistrer le mot de passe pour le moment. Réessayez dans quelques minutes.";

export async function setInitialPassword(_previous: string, form: FormData): Promise<string> {
  const password = form.get("password");
  if (typeof password !== "string" || [...password].length < 12 || Buffer.byteLength(password) > 72) {
    return "Choisissez un mot de passe d’au moins 12 caractères. Raccourcissez-le s’il dépasse la longueur maximale.";
  }
  if (password !== form.get("confirm")) return "Les deux mots de passe doivent être identiques.";

  const invitedId = getSecondAdminUserId();
  const link = invitation.safeParse({ token_hash: form.get("token_hash"), type: form.get("type") });
  if (!invitedId || !link.success) return invalidInvitation;

  try {
    if (!(await allowAdminLogin())) return "Trop de tentatives. Réessayez dans quelques minutes.";

    const client = getSupabaseAdminClient();
    const claimId = randomUUID();
    const { data: claimed, error: claimError } = await client.rpc("bp_admin_claim_invitation", {
      p_user: invitedId, p_digest: createHash("sha256").update(link.data.token_hash).digest("hex"), p_claim: claimId,
    });
    if (claimError) throw claimError;
    if (claimed !== true) return invalidInvitation;

    let activatedAt: string | null = null;
    try {
      const { error } = await client.auth.admin.updateUserById(invitedId, { password, email_confirm: true });
      if (error?.code === "weak_password" || error?.code === "same_password") {
        return "Choisissez un autre mot de passe, plus difficile à deviner.";
      }
      if (error) return unavailable;
      activatedAt = new Date().toISOString();
    } finally {
      const { error } = await client.from("bon_pilotage_admin_invitations")
        .update({ claim_id: null, claim_until: null, activated_at: activatedAt })
        .eq("user_id", invitedId).eq("claim_id", claimId);
      if (error) console.error("Unable to release admin invitation");
    }
  } catch {
    console.error("Admin password setup unavailable");
    return unavailable;
  }

  redirect("/admin?notice=password-set");
}
