"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export function LoginForm({ passwordSet = false }: { passwordSet?: boolean }) {
  const [error, action, pending] = useActionState(signIn, "");
  return (
    <section className="admin-panel admin-login" aria-labelledby="login-title">
      <h1 id="login-title">Administration</h1>
      <p className="admin-muted">Connectez-vous pour accéder aux bons de pilotage.</p>
      {passwordSet && <p role="status" className="admin-banner">Mot de passe enregistré. Vous pouvez vous connecter.</p>}
      <form action={action} className="admin-login-form">
        <label>Adresse e-mail
          <input type="email" name="email" autoComplete="username" autoCapitalize="none" maxLength={254} required />
        </label>
        <label>Mot de passe
          <input type="password" name="password" autoComplete="current-password" maxLength={256} required />
        </label>
        {error && <p role="alert" className="admin-error">{error}</p>}
        <button className="admin-button admin-primary" disabled={pending}>
          {pending ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </section>
  );
}
