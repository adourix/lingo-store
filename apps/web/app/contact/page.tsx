"use client";

import { FormEvent, useCallback, useState } from "react";
import Link from "next/link";
import Turnstile from "../Turnstile";
import Footer from "../Footer";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function ContactPage() {
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [message, setMessage] = useState(""),
    [captcha, setCaptcha] = useState(""),
    [done, setDone] = useState(false),
    [error, setError] = useState("");
  const onCaptcha = useCallback((token: string) => setCaptcha(token), []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const csrf = await fetch(API + "/auth/csrf", { credentials: "include" }).then((r) => r.json());
    const r = await fetch(API + "/public/contact", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "x-csrf-token": csrf.token },
      body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), message, turnstileToken: captcha }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j.error?.message || j.error || "Unable to send message.");
      return;
    }
    setDone(true);
  }

  return (
    <main className="site-shell contact-page">
      <div className="utility-bar">
        <div className="container utility-inner">
          <span>Lingo Mobile Store</span>
          <div><Link href="/about">About</Link><span aria-hidden="true">·</span><Link href="/login">Sign in</Link></div>
        </div>
      </div>
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/" aria-label="Lingo Mobile Store home"><img src="/lingo-logo.svg" alt="Lingo" /></Link>
          <nav className="nav" aria-label="Main navigation"><Link href="/">Home</Link><Link href="/products">Shop</Link><Link href="/categories">Categories</Link><Link href="/about">About</Link><Link href="/contact">Support</Link></nav>
          <div className="header-actions"><Link className="header-action" href="/products">Search</Link><Link className="header-action" href="/account">Account</Link><Link className="header-cart" href="/cart">Cart</Link></div>
        </div>
      </header>

      <section className="container section contact-section">
        <div className="breadcrumbs"><Link href="/">Home</Link> / Contact</div>
        <div className="contact-heading">
          <div><p className="eyebrow">SUPPORT</p><h1>Talk to Lingo.</h1><p className="muted">Have a question about a product, accessories or maintenance? Send us a message and the Lingo team can help.</p></div>
          <div className="contact-direct"><a href="tel:01552854444">01552854444</a><a href="mailto:support@lingostore.store">support@lingostore.store</a></div>
        </div>

        <div className="contact-layout">
          <div className="contact-details">
            <article className="card">
              <p className="eyebrow">VISIT US</p><h2>New Damietta</h2><p className="muted">Decentralized Area, opposite Zahran Supermarket.</p>
              <a className="button secondary" href="https://www.google.com/maps/place/Lingo+Mobile+Store/@31.4368305,31.6779066,18.46z/data=!4m6!3m5!1s0x14f9e362890022eb:0x1e98b3543e888ec1!8m2!3d31.4369094!4d31.6787021!16s%2Fg%2F11fk1nzc0p" target="_blank" rel="noreferrer">Get directions →</a>
            </article>
            <article className="card contact-info-card"><p className="eyebrow">STORE HOURS</p><strong>Usually 1:00 PM – 1:00 AM</strong><span>Hours can vary on specific days.</span></article>
          </div>

          {done ? (
            <section className="card contact-success"><p className="success">Your message has been received.</p><p className="muted">We have your message and will get back to you through the contact details you provided.</p><Link className="button primary" href="/">Back to the store</Link></section>
          ) : (
            <form className="form-stack card contact-form" onSubmit={submit}>
              <div><p className="eyebrow">SEND A MESSAGE</p><h2>How can we help?</h2></div>
              <label>Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required /></label>
              <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} required /></label>
              <label>Message<textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={5000} rows={7} required /></label>
              <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} onToken={onCaptcha} />
              <button className="button primary">Send message</button>
              {error && <p className="error">{error}</p>}
            </form>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
