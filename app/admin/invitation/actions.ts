"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { adminAuthClient, allowAdminLogin, getSecondAdminUserId } from "@/lib/admin-auth";

const invitation = z.object({
  token_hash: z.string().regex(/^[a-zA-Z0-9_-]{32,128}$/),
  type: z.enum(["invite", "recovery"]),
});

const invalidInvitation = "Le lien est invalide ou expiré. Demandez une nouvelle invitation.";
const unavailable = "Impossible d’enregistrer le mot de passe pour le moment. Réessayez dans quelques minutes.";

export async function setInitialPassword(_previous: string, form: FormData): Promise<string> {
  const password = form.get("password");
  if (typeof password !== "string" || [...password].length < 12 || Buffer.byteLength(password) > 72) {
    return "Choisissez un mot de passe d’au moins 12 caractères. Raccourcissez-le s’il dépasse la longueur maximale.";
  }
  if (password !== form.get("confirm")) return "Les deux mots de passe doivent être identiques.";

  const invitedId = getSecondAdminUserId();
  const client = await adminAuthClient("invitation");
  if (!invitedId || !client) return invalidInvitation;

  try {
    // Une session distincte permet de corriger le mot de passe sans réutiliser le lien.
    const existing = await client.auth.getUser();
    let user = existing.data.user;
    if (!user) {
      const link = invitation.safeParse({ token_hash: form.get("token_hash"), type: form.get("type") });
      if (!link.success) return invalidInvitation;
      if (!(await allowAdminLogin())) return "Trop de tentatives. Réessayez dans quelques minutes.";

      const verified = await client.auth.verifyOtp(link.data);
      if (verified.error?.status === 429) return "Trop de tentatives. Réessayez dans quelques minutes.";
      if (verified.error || !verified.data.user) return invalidInvitation;
      user = verified.data.user;
    }

    if (user.id !== invitedId) {
      await client.auth.signOut({ scope: "local" });
      return invalidInvitation;
    }

    const { error } = await client.auth.updateUser({ password });
    if (error?.code === "weak_password" || error?.code === "same_password") {
      return "Choisissez un autre mot de passe, plus difficile à deviner.";
    }
    if (error) return unavailable;

    const logout = await client.auth.signOut({ scope: "local" });
    if (logout.error) console.error("Unable to close invitation session");
  } catch {
    console.error("Admin password setup unavailable");
    return unavailable;
  }

  redirect("/admin?notice=password-set");
}
