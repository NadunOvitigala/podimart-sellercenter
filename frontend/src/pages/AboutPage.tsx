import { Link } from "react-router-dom";
import { PUBLIC_URL } from "../sites";

export function AboutPage() {
  return (
    <div className="wrap content-page">
      <h1>About us</h1>
      <p className="lede">
        Podimart helps home businesses in Sri Lanka open a shop, list cakes and crafts, and
        reach buyers — without building a website.
      </p>
      <div className="panel form stack-panel">
        <h2>Seller Center</h2>
        <p>
          This is where makers run their shop. You can open a free shop, add photos and prices,
          and keep your WhatsApp and pickup notes in one place.
        </p>
        <p>
          Buyers browse on{" "}
          <a className="text-link" href={PUBLIC_URL}>
            Podimart Marketplace
          </a>
          . They contact you directly.
        </p>
        <p>
          We built Seller Center so a home baker or crafter can go from signup to a public shop
          page in a few minutes.
        </p>
        <p>
          <Link className="btn btn-clay" to="/signup">
            Open a free shop
          </Link>
        </p>
      </div>
    </div>
  );
}
