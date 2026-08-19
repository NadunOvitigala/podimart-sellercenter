import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { PUBLIC_URL } from "../sites";

export function HomePage() {
  const { token } = useAuth();

  return (
    <div className="wrap">
      <section className="hero">
        <div>
          <h1>Run your home shop from one place</h1>
          <p className="lede">
            Open a free shop, add cakes or crafts, and let buyers on Podimart Marketplace
            message you on WhatsApp. No website needed.
          </p>
          <div className="hero-actions">
            {token ? (
              <>
                <Link className="btn btn-clay" to="/dashboard">
                  Go to my shop
                </Link>
                <a className="btn btn-outline" href={PUBLIC_URL}>
                  Marketplace
                </a>
              </>
            ) : (
              <>
                <Link className="btn btn-clay" to="/signup">
                  Open a free shop
                </Link>
                <Link className="btn btn-clay" to="/login">
                  Log in
                </Link>
              </>
            )}
          </div>
          <ul className="points">
            <li>
              <img src="/images/badge-verified.png" alt="" />
              Free listings. Buyers contact you directly.
            </li>
            <li>
              <img src="/images/badge-verified.png" alt="" />
              Your public shop lives on Podimart Marketplace.
            </li>
            <li>
              <img src="/images/badge-verified.png" alt="" />
              Photos, prices, and WhatsApp in one dashboard.
            </li>
          </ul>
        </div>
        <div className="hero-photo">
          <img src="/images/hero-seller.png" alt="A maker managing her shop on a laptop" />
        </div>
      </section>
    </div>
  );
}
