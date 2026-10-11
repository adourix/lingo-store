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
    <div className="admin-page users-page">
      <div className="users-page-head">
        <div>
          <div className="admin-eyebrow">Access management</div>
          <h1>Staff & Admins</h1>
          <p className="admin-page-description">
            Invite staff members and require password + MFA setup before activation.
          </p>
        </div>
      </div>

      <div className="users-page-grid">
        <section className="admin-card users-invite-card">
          <div className="admin-card-head">
            <div>
              <h2>New staff invitation</h2>
              <p>Create an invitation for a new store operator or administrator.</p>
            </div>
            <span className="admin-card-icon" aria-hidden="true">+</span>
          </div>

          <form onSubmit={create} className="users-form">
            <div className="users-form-grid">
              <label>
                <span>Full name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmed Ali" required />
              </label>
              <label>
                <span>Username</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. ahmed" required />
              </label>
              <label className="users-form-wide">
                <span>Email</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@company.com" required />
              </label>
              <label>
                <span>Role</span>
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  {roles.map((item) => (
                    <option key={item.name} value={item.name}>{item.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="users-stepup">
              <div className="users-stepup-copy">
                <div className="admin-eyebrow">Security check</div>
                <h3>Confirm your Admin identity</h3>
                <p>Enter your current Admin credentials to authorize this invitation.</p>
              </div>
              <div className="users-form-grid users-security-grid">
                <label>
                  <span>Current Admin password</span>
                  <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Your current password" required />
                </label>
                <label>
                  <span>MFA code</span>
                  <input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" maxLength={6} pattern="[0-9]{6}" placeholder="6-digit code" required />
                </label>
              </div>
            </div>

            {error && <div className="admin-alert error" role="alert">{error}</div>}

            <div className="users-form-actions">
              <button className="admin-button primary" type="submit">Create invitation</button>
            </div>
          </form>
        </section>

        {result && (
          <section className="admin-card users-result-card">
            <div className="users-result-icon" aria-hidden="true">✓</div>
            <div>
              <div className="admin-eyebrow">Invitation created</div>
              <h2>Invitation sent</h2>
              <p>
                The setup link was sent to the invitee and expires at {new Date(result.expiresAt).toLocaleString()}.
              </p>
              <small>The setup token and MFA secret are not shown to the inviter.</small>
            </div>
          </section>
        )}
      </div>

      <section className="admin-card users-table-card">
        <div className="admin-card-head">
          <div>
            <div className="admin-eyebrow">Directory</div>
            <h2>Current staff</h2>
            <p>Accounts and their current access/setup status.</p>
          </div>
          <span className="users-count">{list.length} {list.length === 1 ? "member" : "members"}</span>
        </div>

        <div className="admin-table-wrap">
          <table className="users-table">
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
              {list.length ? list.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong></td>
                  <td className="users-muted">{item.username}</td>
                  <td><span className="users-role">{item.role}</span></td>
                  <td><span className={`users-status ${item.status.toLowerCase().replace(/_/g, "-")}`}>{item.status}</span></td>
                  <td><span className={`users-mfa ${item.mfaEnabled ? "enabled" : "pending"}`}><i />{item.mfaEnabled ? "Enabled" : "Pending"}</span></td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="users-empty">No staff accounts found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
