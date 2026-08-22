import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { PUBLIC_URL } from "../sites";

export function HomePage() {
  const { token } = useAuth();

  return (
    <div className="wrap mall">
      <section className="promo-banner">
        <div className="promo-copy">
          <span className="eyebrow">SELLER CENTER · PODIMART.LK</span>
          <h1>Run your home shop from one place</h1>
          <p className="lede">
            Open a free shop, add cakes or crafts, and let buyers on podimart.lk message you
            on WhatsApp. No website needed.
          </p>
          <div className="hero-actions">
            {token ? (
              <>
                <Link className="btn btn-light" to="/dashboard">
                  Go to my shop
                </Link>
                <a className="btn btn-ghost-light" href={PUBLIC_URL}>
                  Marketplace
                </a>
              </>
            ) : (
              <>
                <Link className="btn btn-light" to="/signup">
                  Open a free shop
                </Link>
                <Link className="btn btn-ghost-light" to="/login">
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="promo-visual">
          <img
            className="promo-photo"
            src="/images/hero-seller.png"
            alt="A maker managing her shop on a laptop"
          />
        </div>
      </section>

      <section className="how-grid">
        <article className="how-card">
          <span className="how-num">1</span>
          <h3>Open a free shop</h3>
          <p>Create your shop with province, WhatsApp, and a cover photo.</p>
        </article>
        <article className="how-card">
          <span className="how-num">2</span>
          <h3>Add products</h3>
          <p>Upload photos, set prices, and get a Product ID buyers can quote.</p>
        </article>
        <article className="how-card">
          <span className="how-num">3</span>
          <h3>Get orders on WhatsApp</h3>
          <p>Buyers find you on podimart.lk and contact you directly.</p>
        </article>
      </section>
    </div>
  );
}
