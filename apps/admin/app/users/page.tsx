"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Staff = {
  id: string;
  username: string;
  name: string;
  role: string;
  status: string;
  isActive: boolean;
  mfaEnabled: boolean;
};

type InviteResult = { inviteId: string; expiresAt: string };

export default function Users() {
  const [list, setList] = useState<Staff[]>([]);
  const [roles, setRoles] = useState<{ name: string }[]>([]);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("ADMIN");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [result, setResult] = useState<InviteResult | null>(null);
  const [error, setError] = useState("");

  const load = () =>
    fetch(API + "/admin/users", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setList)
      .catch(() => setError("Failed to load staff"));

  useEffect(() => {
    load();
    fetch(API + "/admin/users/assignable-roles", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : []))
      .then((items) => {
        setRoles(items);
        if (items[0]) setRole(items[0].name);
      })
      .catch(() => {});
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setResult(null);

    const csrf = await fetch(API + "/admin/auth/csrf", { credentials: "include" }).then((r) =>
      r.json(),
    );
    const stepUpResponse = await fetch(API + "/admin/auth/step-up", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf.token },
      credentials: "include",
      body: JSON.stringify({ password, otp }),
    });

    if (!stepUpResponse.ok) {
      setError("Step-up failed: enter the current Admin password and authenticator code.");
      return;
    }

    const stepUp = await stepUpResponse.json();
    const response = await fetch(API + "/admin/users/invitations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": stepUp.csrfToken || csrf.token,
      },
      credentials: "include",
      body: JSON.stringify({ name, username, email, role }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || "Create failed");
      return;
    }

    setResult(data);
    setName("");
    setUsername("");
    setEmail("");
    setPassword("");
    setOtp("");
    load();
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: 32, maxWidth: 1100 }}>
      <h1>Staff & Admins</h1>
      <p>Create an invitation. The invitee completes password + MFA setup before activation.</p>
      <form onSubmit={create} style={{ display: "grid", gap: 10, maxWidth: 560 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          required
        />
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          required
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Email"
          required
        />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {roles.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
        <hr />
        <strong>Confirm your Admin identity</strong>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Your current Admin password"
          required
        />
        <input
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          inputMode="numeric"
          maxLength={6}
          placeholder="Your current MFA code"
          required
        />
        <button type="submit">Create invitation</button>
      </form>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {result && (
        <section style={{ marginTop: 24, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
          <h2>Invitation sent</h2>
          <p>
            The setup link was sent to the invitee. It expires at{" "}
            {new Date(result.expiresAt).toLocaleString()}.
          </p>
          <p>For security, the setup token and MFA secret are not shown to the inviter.</p>
        </section>
      )}
      <h2 style={{ marginTop: 32 }}>Current staff</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Username</th>
            <th>Role</th>
            <th>Status</th>
            <th>MFA</th>
          </tr>
        </thead>
        <tbody>
          {list.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.username}</td>
              <td>{item.role}</td>
              <td>{item.status}</td>
              <td>{item.mfaEnabled ? "Enabled" : "Pending"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
