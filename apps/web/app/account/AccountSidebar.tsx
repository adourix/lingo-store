"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
type Profile = { name?: string | null; email?: string | null; emailVerified?: boolean };
type Props = { active: "overview" | "orders" | "favorites" | "profile" | "security"; profile?: Profile | null };

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: "M4 11.5 12 5l8 6.5v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z M9 20v-5h6v5",
    orders: "M4 7h16v13H4z M7 7V5h10v2 M8 11h8 M8 15h5",
    heart: "M20.8 8.9c0 5.2-8.8 10-8.8 10s-8.8-4.8-8.8-10A4.8 4.8 0 0 1 12 6.4a4.8 4.8 0 0 1 8.8 2.5Z",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 21c.7-4 3.2-6 7.5-6s6.8 2 7.5 6",
    shield: "M12 3 19 6v5.5c0 4.3-2.5 7.5-7 9.5-4.5-2-7-5.2-7-9.5V6z M9 12l2 2 4-4",
    logout: "M10 5H5v14h5 M14 8l4 4-4 4 M9 12h9",
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function Avatar() {
  return <span className="account-sidebar-avatar"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="17" r="7" /><path d="M10.5 39c1.7-7.2 6.3-10.8 13.5-10.8S35.8 31.8 37.5 39" /></svg></span>;
}

export default function AccountSidebar({ active, profile: supplied }: Props) {
  const [profile, setProfile] = useState<Profile | null | undefined>(supplied);
  useEffect(() => {
    if (supplied !== undefined) { setProfile(supplied); return; }
    fetch(API + "/account/profile", { credentials: "include", cache: "no-store" })
      .then(async (r) => { if (r.status === 401) { location.href = "/login"; return null; } if (!r.ok) return null; return await r.json() as Profile; })
      .then(setProfile).catch(() => setProfile(null));
  }, [supplied]);
  async function logout() {
    const csrf = await fetch(API + "/auth/csrf", { credentials: "include" }).then((r) => r.json());
    await fetch(API + "/auth/logout", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": csrf.token }, body: "{}" });
    location.href = "/";
  }
  const links = [
    ["overview", "/account", "Overview", "home"],
    ["orders", "/account/orders", "Orders", "orders"],
    ["favorites", "/account/favorites", "Favorites", "heart"],
    ["profile", "/account/profile", "Profile", "user"],
    ["security", "/account/security", "Security", "shield"],
  ] as const;
  return <aside className="account-nav" aria-label="Account navigation">
    <div className="account-nav-brand"><Avatar /><div><strong>{profile?.name || "Customer"}</strong>{profile?.email && <small>{profile.email}</small>}{profile?.emailVerified && <span className="account-verified">● Verified</span>}</div></div>
    <div className="account-nav-links">{links.map(([key, href, label, icon]) => <Link key={key} className={active === key ? "active" : ""} href={href}><Icon name={icon} /><span>{label}</span></Link>)}</div>
    <button type="button" className="account-signout" onClick={logout}><Icon name="logout" /><span>Sign out</span></button>
  </aside>;
}
