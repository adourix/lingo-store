import Link from "next/link";
import Footer from "../Footer";

export default function About() {
  return (
    <main className="site-shell about-page">
      <div className="utility-bar">
        <div className="container utility-inner">
          <span>Lingo Mobile Store</span>
          <div>
            <Link href="/contact">Need help?</Link>
            <span aria-hidden="true">·</span>
            <Link href="/login">Sign in</Link>
          </div>
        </div>
      </div>

      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/" aria-label="Lingo Mobile Store home">
            <img src="/lingo-logo.svg" alt="Lingo" />
          </Link>
          <nav className="nav" aria-label="Main navigation">
            <Link href="/">Home</Link>
            <Link href="/products">Shop</Link>
            <Link href="/categories">Categories</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Support</Link>
          </nav>
          <div className="header-actions">
            <Link className="header-action" href="/products">Search</Link>
            <Link className="header-action" href="/account">Account</Link>
            <Link className="header-cart" href="/cart">Cart</Link>
          </div>
        </div>
      </header>

      <section className="container section about-hero">
        <div className="breadcrumbs"><Link href="/">Home</Link> / About</div>
        <div className="about-hero-grid">
          <div>
            <p className="eyebrow">ABOUT LINGO</p>
            <h1>Mobile technology, products and service — in one place.</h1>
            <p className="about-lede">
              Lingo Mobile Store is a mobile retail business serving customers with phones, accessories and maintenance services. We started in 2019 and continue to grow our presence across Egypt and Saudi Arabia.
            </p>
            <div className="actions">
              <Link className="button primary" href="/products">Shop products</Link>
              <Link className="text-action" href="/contact">Talk to Lingo <span aria-hidden="true">→</span></Link>
            </div>
          </div>
          <div className="about-identity-card">
            <span className="about-card-label">LINGO MOBILE STORE</span>
            <strong>Since 2019</strong>
            <div className="about-card-rule" />
            <span>New Damietta · Egypt</span>
            <span>Presence in Egypt & Saudi Arabia</span>
          </div>
        </div>
      </section>

      <section className="container section about-story-section">
        <div className="about-section-heading">
          <p className="eyebrow">OUR STORY</p>
          <h2>Built around what mobile customers actually need.</h2>
        </div>
        <div className="about-story-copy">
          <p>
            Lingo started in 2019 with a focus on mobile products and the everyday services that come with them. Instead of treating the phone as a single purchase, we bring the wider mobile experience together: choosing a device, finding the right accessories and getting maintenance when a device needs attention.
          </p>
          <p>
            Today, Lingo has a presence in Egypt and Saudi Arabia, while the New Damietta store remains a local point for customers looking for mobile products and service.
          </p>
        </div>
      </section>

      <section className="container section about-offer-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">WHAT WE DO</p>
            <h2>More than a phone shop.</h2>
          </div>
        </div>
        <div className="grid about-offer-grid">
          <article className="card about-offer-card">
            <span className="about-number">01</span>
            <h3>Mobile phones</h3>
            <p className="muted">Shop mobile devices for different needs, preferences and budgets through the Lingo catalog.</p>
          </article>
          <article className="card about-offer-card">
            <span className="about-number">02</span>
            <h3>Accessories</h3>
            <p className="muted">Find the accessories that help protect, connect and get more from your mobile device.</p>
          </article>
          <article className="card about-offer-card">
            <span className="about-number">03</span>
            <h3>Maintenance</h3>
            <p className="muted">When a device needs attention, Lingo provides mobile maintenance and repair support.</p>
          </article>
        </div>
      </section>

      <section className="container section about-values-section">
        <div className="about-values-panel">
          <div>
            <p className="eyebrow">WHY LINGO</p>
            <h2>A straightforward mobile experience.</h2>
            <p>We focus on the parts of mobile retail that matter most: useful products, practical accessories and service customers can return to when they need it.</p>
          </div>
          <div className="about-values-list">
            <div><strong>01</strong><span><b>Experience</b> — serving mobile customers since 2019.</span></div>
            <div><strong>02</strong><span><b>One place</b> — phones, accessories and maintenance together.</span></div>
            <div><strong>03</strong><span><b>Growing presence</b> — serving customers in Egypt and Saudi Arabia.</span></div>
            <div><strong>04</strong><span><b>Practical service</b> — helping customers choose, use and maintain their devices.</span></div>
          </div>
        </div>
      </section>

      <section className="container section about-location-section">
        <div className="about-location-card">
          <div>
            <p className="eyebrow">VISIT US</p>
            <h2>New Damietta, Egypt.</h2>
            <p>Decentralized Area, opposite Zahran Supermarket.</p>
            <a className="button secondary" href="https://www.google.com/maps/place/Lingo+Mobile+Store/@31.4368305,31.6779066,18.46z/data=!4m6!3m5!1s0x14f9e362890022eb:0x1e98b3543e888ec1!8m2!3d31.4369094!4d31.6787021!16s%2Fg%2F11fk1nzc0p" target="_blank" rel="noreferrer">Get directions →</a>
          </div>
          <div className="about-location-meta">
            <span>PHONE</span>
            <a href="tel:01552854444">01552854444</a>
            <span>EMAIL</span>
            <a href="mailto:support@lingostore.store">support@lingostore.store</a>
            <span>HOURS</span>
            <strong>Usually 1:00 PM – 1:00 AM</strong>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
