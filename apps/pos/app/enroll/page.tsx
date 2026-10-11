"use client";

import { FormEvent, useState } from "react";
import { enroll } from "../../lib/api";

export default function EnrollPage() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await enroll(code.trim(), name.trim());
      window.location.href = "/login";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrollment failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="pos-auth-shell">
      <section className="pos-auth-panel" aria-label="Register terminal">
        <div className="pos-auth-brand">
          <img src="/lingo-logo.svg" alt="Lingo" />
          <span>POS</span>
        </div>
        <div className="pos-auth-intro">
          <p className="pos-auth-kicker">Terminal setup</p>
          <h1>Register this terminal</h1>
          <p>Connect this device to Lingo Store with the one-time enrollment code from an administrator.</p>
        </div>
        <div className="pos-enroll-steps" aria-label="Enrollment steps">
          <span className="active"><b>1</b> Enter code</span>
          <span><b>2</b> Name terminal</span>
          <span><b>3</b> Sign in</span>
        </div>
        <form className="pos-auth-form" onSubmit={submit}>
          <label>
            <span>Enrollment code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoFocus
              inputMode="text"
              spellCheck={false}
              required
            />
            <small>Paste the code exactly as shown by the administrator. It is case-sensitive.</small>
          </label>
          <label>
            <span>Terminal name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Front counter"
              maxLength={80}
              required
            />
            <small>Choose a short name that identifies this checkout station.</small>
          </label>
          {error && <p className="pos-auth-error" role="alert">{error}</p>}
          <button className="pos-auth-submit" disabled={saving}>
            {saving ? "Registering…" : "Register terminal"}
          </button>
        </form>
        <div className="pos-auth-divider"><span>Already registered?</span></div>
        <a className="pos-auth-secondary" href="/login">Return to cashier sign in</a>
      </section>
      <aside className="pos-auth-side" aria-hidden="true">
        <div className="pos-auth-side-mark">L</div>
        <strong>One device.<br />One terminal.</strong>
        <span>Register once, then use the normal cashier sign-in.</span>
      </aside>
    </main>
  );
}
