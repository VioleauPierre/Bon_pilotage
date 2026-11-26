"use client";

import { useActionState, useSyncExternalStore } from "react";
import { setInitialPassword } from "./actions";

function subscribeToFragment(update: () => void) {
  window.addEventListener("hashchange", update);
  return () => window.removeEventListener("hashchange", update);
}

export function InvitationForm() {
  const [error, submit, pending] = useActionState(setInitialPassword, "");
  // Le fragment reste dans le navigateur tant que le formulaire n’est pas envoyé.
  const fragment = useSyncExternalStore(subscribeToFragment, () => window.location.hash, () => "");
  const link = new URLSearchParams(fragment.slice(1));

  return (
    <section className="admin-panel admin-login" aria-labelledby="invitation-title">
      <h1 id="invitation-title">Choisir un mot de passe</h1>
      <p className="admin-muted">Activez votre accès à Bon Pilotage avec un mot de passe d’au moins 12 caractères.</p>
      <form action={submit} className="admin-login-form">
        <input type="hidden" name="token_hash" value={link.get("token_hash") ?? ""} />
        <input type="hidden" name="type" value={link.get("type") ?? ""} />
        <label>Nouveau mot de passe
          <input type="password" name="password" autoComplete="new-password" minLength={12} maxLength={72} required />
        </label>
        <label>Confirmer le mot de passe
          <input type="password" name="confirm" autoComplete="new-password" minLength={12} maxLength={72} required />
        </label>
        {error && <p role="alert" className="admin-error">{error}</p>}
        <button className="admin-button admin-primary" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer le mot de passe"}
        </button>
      </form>
    </section>
  );
}
