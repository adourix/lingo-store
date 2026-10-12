import Link from "next/link";

export default function Footer() {
  return (
    <footer className="site-footer site-footer-rich">
      <div className="container footer-rich-grid">
        <div className="footer-brand-block">
          <Link href="/" aria-label="Lingo Mobile Store home">
            <img className="footer-logo" src="/lingo-logo.svg" alt="Lingo" />
          </Link>
          <p>Lingo Mobile Store</p>
          <span>Mobile phones, accessories and maintenance.</span>
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
          <a href="https://www.google.com/maps/place/Lingo+Mobile+Store/@31.4368305,31.6779066,18.46z/data=!4m6!3m5!1s0x14f9e362890022eb:0x1e98b3543e888ec1!8m2!3d31.4369094!4d31.6787021!16s%2Fg%2F11fk1nzc0p" target="_blank" rel="noreferrer">Egypt location</a>
        </div>

        <div className="footer-column footer-contact-column">
          <h3>Support</h3>
          <a href="tel:01552854444">01552854444</a>
          <a href="mailto:support@lingostore.store">support@lingostore.store</a>
          <span>Usually open 1:00 PM – 1:00 AM</span>
          <span>New Damietta, Egypt</span>
        </div>
      </div>

      <div className="container footer-location-strip">
        <div>
          <strong>New Damietta</strong>
          <span>Decentralized Area · Opposite Zahran Supermarket</span>
        </div>
        <a href="https://www.google.com/maps/place/Lingo+Mobile+Store/@31.4368305,31.6779066,18.46z/data=!4m6!3m5!1s0x14f9e362890022eb:0x1e98b3543e888ec1!8m2!3d31.4369094!4d31.6787021!16s%2Fg%2F11fk1nzc0p" target="_blank" rel="noreferrer">Get directions →</a>
      </div>

      <div className="container footer-bottom">
        <span>© 2026 Lingo Mobile Store. All rights reserved.</span>
        <div>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms & Conditions</Link>
        </div>
      </div>
    </footer>
  );
}
