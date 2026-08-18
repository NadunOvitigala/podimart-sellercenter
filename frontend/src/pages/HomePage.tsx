import { Link } from "react-router-dom";
import { useAuth } from "../auth";

export function HomePage() {
  const { token } = useAuth();

  return (
    <div className="wrap">
      <section className="hero">
        <div>
          <p className="muted">sellercenter.podimart.lk</p>
          <h1>Run your home shop from one place</h1>
          <p className="lede">
            Open a free shop, add cakes or crafts, and let buyers on podimart.lk
            message you on WhatsApp. No website needed.
          </p>
          <div className="hero-actions">
            {token ? (
              <Link className="btn btn-clay" to="/dashboard">
                Go to my shop
              </Link>
            ) : (
              <>
                <Link className="btn btn-clay" to="/signup">
                  Open a free shop
                </Link>
                <Link className="btn btn-ghost" to="/login">
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
              Your public shop lives on podimart.lk.
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
