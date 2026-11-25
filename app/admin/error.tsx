"use client";

import Link from "next/link";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <section className="admin-panel admin-detail">
      <h1>Administration indisponible</h1>
      <p>Réessayez dans quelques instants.</p>
      <div className="admin-inline-actions">
        <button onClick={reset} className="admin-button admin-primary">Réessayer</button>
        <Link href="/admin" className="admin-button">Retour aux bons</Link>
      </div>
    </section>
  );
}
