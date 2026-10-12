import Link from "next/link";

const MAPS_URL = "https://www.google.com/maps/place/Lingo+Mobile+Store/@31.4368305,31.6779066,18.46z/data=!4m6!3m5!1s0x14f9e362890022eb:0x1e98b3543e888ec1!8m2!3d31.4369094!4d31.6787021!16s%2Fg%2F11fk1nzc0p";

export default function Footer() {
  return (
    <footer className="site-footer site-footer-rich">
      <div className="container footer-rich-grid">
        <div className="footer-brand-block">
          <Link href="/" className="footer-brand-link" aria-label="Lingo Mobile Store home">
            <img className="footer-logo" src="/lingo-logo.svg" alt="Lingo" />
          </Link>
          <h2>Lingo Mobile Store</h2>
          <p>Mobile phones, accessories and maintenance.</p>
          <span>Serving customers since 2019.</span>
        </div>

        <div className="footer-column">
          <h3>Shop</h3>
          <Link href="/products">Products</Link>
          <Link href="/categories">Categories</Link>
          <Link href="/cart">Cart</Link>
        </div>

        <div className="footer-column">
          <h3>Company</h3>
          <Link href="/about">About Lingo</Link>
          <Link href="/contact">Contact</Link>
          <a href={MAPS_URL} target="_blank" rel="noreferrer">Egypt location</a>
        </div>

        <div className="footer-column footer-contact-column">
          <h3>Get in touch</h3>
          <a className="footer-contact-value" href="tel:01552854444">01552854444</a>
          <a className="footer-contact-value" href="mailto:support@lingostore.store">support@lingostore.store</a>
          <span>Usually open 1:00 PM – 1:00 AM</span>
        </div>
      </div>

      <div className="container footer-location-strip">
        <div className="footer-location-copy">
          <span className="footer-location-kicker">VISIT LINGO</span>
          <strong>New Damietta, Egypt</strong>
          <span>Decentralized Area · Opposite Zahran Supermarket</span>
        </div>
        <a className="footer-directions" href={MAPS_URL} target="_blank" rel="noreferrer">Get directions <span aria-hidden="true">↗</span></a>
      </div>

      <div className="container footer-bottom">
        <span>© 2026 Lingo Mobile Store. All rights reserved.</span>
        <div><Link href="/about">About</Link><Link href="/contact">Contact</Link></div>
      </div>
    </footer>
  );
}
