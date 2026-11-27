"use client";

import { useState, type FormEvent } from "react";

export function ZipSelection({ limit }: { limit: number }) {
  const [message, setMessage] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    const count = new FormData(event.currentTarget).getAll("id").length;
    if (count && count <= limit) {
      setMessage("");
      return;
    }
    event.preventDefault();
    setMessage(count ? `Sélectionnez au maximum ${limit} bons.` : "Sélectionnez au moins un bon.");
  }

  return (
    <form id="zip-selection" action="/api/admin/bons/zip" className="admin-selection" onSubmit={submit}>
      <input type="hidden" name="mode" value="selected" />
      <button className="admin-button">ZIP de la sélection</button>
      {message && <span className="admin-error" role="alert">{message}</span>}
    </form>
  );
}
