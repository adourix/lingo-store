"use client";

import { FormEvent, useCallback, useState } from "react";
import Link from "next/link";
import Turnstile from "../Turnstile";
import Footer from "../Footer";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const MAP_URL = "https://www.google.com/maps/place/Lingo+Mobile+Store/@31.4368305,31.6779066,18.46z/data=!4m6!3m5!1s0x14f9e362890022eb:0x1e98b3543e888ec1!8m2!3d31.4369094!4d31.6787021!16s%2Fg%2F11fk1nzc0p";

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="support-icon" aria-hidden="true">{children}</span>;
}

function PhoneIcon() {
  return <Icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7.4 3.5 4.8 4.7c-.8.4-1.2 1.3-.9 2.1 1.9 6.2 5.9 10.2 12.1 12.1.8.2 1.7-.2 2.1-.9l1.2-2.6c.3-.7 0-1.5-.7-1.8l-3.2-1.5c-.6-.3-1.4-.1-1.8.5l-1 1.2a13.2 13.2 0 0 1-4.7-4.7l1.2-1c.6-.5.8-1.2.5-1.8L9.2 4.2c-.3-.7-1.1-1-1.8-.7Z"/></svg></Icon>;
}

function PinIcon() {
  return <Icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 10.2c0 5.1-8 10.8-8 10.8S4 15.3 4 10.2a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.4"/></svg></Icon>;
}

function ChatIcon() {
  return <Icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 11.5a7 7 0 0 1-7 7H9l-4 2 .9-3.4A7 7 0 1 1 20 11.5Z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" strokeWidth="2.5" strokeLinecap="round"/></svg></Icon>;
}

function HeadsetIcon() {
  return <Icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 13a8 8 0 0 1 16 0"/><path d="M4 13v3.5A2.5 2.5 0 0 0 6.5 19H8v-7H6.5A2.5 2.5 0 0 0 4 14.5M20 13v3.5A2.5 2.5 0 0 1 17.5 19H16v-7h1.5a2.5 2.5 0 0 1 2.5 2.5"/></svg></Icon>;
}

function ClockIcon() {
  return <Icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg></Icon>;
}

function MailIcon() {
  return <Icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m5 7 7 5 7-5"/></svg></Icon>;
}

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
    try {
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
    } catch {
      setError("Unable to send message right now. Please try again.");
    }
  }

  return (
    <main className="site-shell contact-page">
      <div className="utility-bar">
        <div className="container utility-inner">
          <span>Lingo Mobile Store</span>
          <div><Link href="/contact">Need help?</Link><span aria-hidden="true">·</span><Link href="/login">Sign in</Link></div>
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

        <div className="support-hero">
          <div className="support-hero-copy">
            <p className="eyebrow">SUPPORT</p>
            <h1>Talk to <span>Lingo.</span></h1>
            <p className="support-lede">Have a question about a product, accessories or maintenance? Send us a message and the Lingo team can help.</p>
            <div className="support-topics">
              <div><PhoneIcon /><span><strong>Product inquiries</strong><small>Get details before you buy</small></span></div>
              <div><Icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19 13.5a7.4 7.4 0 0 0 0-3l1.5-1.1-2-3.4-1.8.7a7.5 7.5 0 0 0-2.5-1.5L14 3h-4l-.3 2.2a7.5 7.5 0 0 0-2.5 1.5l-1.8-.7-2 3.4L5 10.5a7.4 7.4 0 0 0 0 3l-1.5 1.1 2 3.4 1.8-.7a7.5 7.5 0 0 0 2.5 1.5L10 21h4l.3-2.2a7.5 7.5 0 0 0 2.5-1.5l1.8.7 2-3.4Z"/></svg></Icon><span><strong>Maintenance support</strong><small>We help with your devices</small></span></div>
              <div><ChatIcon /><span><strong>General questions</strong><small>Our team is ready</small></span></div>
            </div>
          </div>

          <div className="support-visual" aria-hidden="true">
            <div className="support-orbit support-orbit-one" />
            <div className="support-orbit support-orbit-two" />
            <div className="support-store-card">
              <div className="support-store-top"><img src="/lingo-logo.svg" alt="" /><span>Mobile Store</span></div>
              <div className="support-store-shelves"><i/><i/><i/><i/><i/><i/></div>
              <div className="support-counter"><b>Lingo</b><span>Phones · Accessories · Service</span></div>
            </div>
            <div className="support-float-card"><HeadsetIcon /><div><strong>We're here<br/>to help</strong><span>Fast support for phones, accessories and maintenance.</span></div></div>
          </div>
        </div>

        <div className="support-main-grid">
          <div className="support-left">
            <article className="support-location-card card">
              <div className="support-card-copy"><PinIcon /><div><p className="eyebrow">VISIT US</p><h2>New Damietta</h2><p>Decentralized Area, opposite<br className="desktop-only"/> Zahran Supermarket.</p><a className="button secondary" href={MAP_URL} target="_blank" rel="noreferrer">Get directions <span>→</span></a></div></div>
              <a className="support-map" href={MAP_URL} target="_blank" rel="noreferrer" aria-label="Open Lingo Store location in Google Maps"><span className="map-road road-a"/><span className="map-road road-b"/><span className="map-road road-c"/><span className="map-block block-a"/><span className="map-block block-b"/><span className="map-block block-c"/><span className="map-pin"><PinIcon /></span><b>Zahran<br/>Supermarket</b></a>
            </article>

            <article className="support-hours-card card">
              <ClockIcon />
              <div><p className="eyebrow">STORE HOURS</p><h2>Usually 1:00 PM – 1:00 AM</h2><p>Hours can vary on specific days.</p></div>
              <div className="hours-list"><div><span>Saturday - Thursday</span><strong>1:00 PM – 1:00 AM</strong></div><div><span>Friday</span><strong>1:00 PM – 12:00 AM</strong></div><div><span>Public holidays</span><strong>May vary</strong></div></div>
            </article>
          </div>

          {done ? (
            <section className="card contact-success support-form-card"><ChatIcon /><p className="success">Your message has been received.</p><p className="muted">We have your message and will get back to you through the contact details you provided.</p><Link className="button primary" href="/">Back to the store</Link></section>
          ) : (
            <form className="card contact-form support-form-card" onSubmit={submit}>
              <div className="support-form-heading"><ChatIcon /><div><p className="eyebrow">SEND A MESSAGE</p><h2>How can we help?</h2></div></div>
              <label>Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Your name" required /></label>
              <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} placeholder="you@example.com" required /></label>
              <label>Message<textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={5000} rows={5} placeholder="Tell us about your inquiry..." required /></label>
              <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} onToken={onCaptcha} />
              <button className="button primary" type="submit">Send message <span>→</span></button>
              {error && <p className="error">{error}</p>}
            </form>
          )}
        </div>

        <section className="support-contact-strip">
          <div><PhoneIcon /><span><small>Call us</small><a href="tel:01552854444">01552854444</a><em>Usually open 1:00 PM - 1:00 AM</em></span></div>
          <div><MailIcon /><span><small>Email us</small><a href="mailto:support@lingostore.store">support@lingostore.store</a><em>We reply as soon as possible</em></span></div>
          <div><PinIcon /><span><small>Visit our store</small><a href={MAP_URL} target="_blank" rel="noreferrer">New Damietta</a><em>Opposite Zahran Supermarket</em></span></div>
        </section>
      </section>
      <Footer />
    </main>
  );
}
