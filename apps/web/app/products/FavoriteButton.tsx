"use client";

import type { MouseEvent } from "react";
import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function FavoriteButton({
  productId,
  favorite,
  onChange,
}: {
  productId: string;
  favorite: boolean;
  onChange: (favorite: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function toggle(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const csrf = await fetch(API + "/auth/csrf", { credentials: "include" }).then(async (response) => {
        if (!response.ok) throw new Error("CSRF_UNAVAILABLE");
        return response.json() as Promise<{ token?: string }>;
      });
      const response = await fetch(API + "/account/favorites/" + encodeURIComponent(productId), {
        method: favorite ? "DELETE" : "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": typeof csrf.token === "string" ? csrf.token : "",
        },
        body: "{}",
      });
      if (response.status === 401) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = "/login?next=" + next;
        return;
      }
      if (!response.ok) throw new Error("FAVORITE_FAILED");
      onChange(!favorite);
    } catch {
      // The catalog remains usable when favorites are unavailable.
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={favorite ? "favorite-button active" : "favorite-button"}
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={favorite}
      disabled={busy}
      onClick={toggle}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M20.8 8.7c0 5.2-8.8 10.1-8.8 10.1S3.2 13.9 3.2 8.7A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.8 2.3Z" />
      </svg>
    </button>
  );
}
