import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatPrice, mediaUrl } from "../api";
import { useAuth } from "../auth";
import { PUBLIC_URL } from "../sites";
import type { Product, Seller } from "../types";

export function DashboardPage() {
  const { token, ready } = useAuth();
  const navigate = useNavigate();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    api.cities().then(setCities).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      navigate("/login");
      return;
    }
    api
      .me()
      .then((data) => {
        setSeller(data.seller);
        setProducts(data.products);
      })
      .catch((err: Error) => {
        if (err.message.includes("finish creating")) {
          navigate("/signup");
          return;
        }
        setError(err.message);
      });
  }, [token, ready, navigate]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!seller) return;
    setError("");
    setSaved("");
    try {
      const updated = await api.updateMe({
        name: seller.name,
        city: seller.city,
        bio: seller.bio,
        whatsapp: seller.whatsapp,
        phone: seller.phone,
        email_public: seller.email_public,
        pickup_notes: seller.pickup_notes,
        delivery_notes: seller.delivery_notes,
      });
      setSeller(updated);
      setSaved("Shop details saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  async function removeProduct(id: string) {
    if (!confirm("Remove this listing?")) return;
    await api.deleteProduct(id);
    setProducts((items) => items.filter((item) => item.id !== id));
  }

  if (!seller) {
    return (
      <div className="wrap" style={{ paddingTop: 40 }}>
        {error ? <p className="error">{error}</p> : "Loading your shop…"}
      </div>
    );
  }

  const publicShop = `${PUBLIC_URL}/shop/${seller.slug}`;

  return (
    <div className="wrap" style={{ paddingTop: 28, paddingBottom: 40 }}>
      <div className="section-head">
        <div>
          <h1>Your shop</h1>
          <p className="muted">
            Public page:{" "}
            <a href={publicShop} target="_blank" rel="noreferrer">
              {publicShop}
            </a>
          </p>
        </div>
        <Link className="btn btn-clay" to="/dashboard/new">
          Add a product
        </Link>
      </div>

      <div className="product-layout">
        <form className="panel form" onSubmit={saveProfile}>
          <h2>Shop profile</h2>
          {error ? <div className="error">{error}</div> : null}
          {saved ? <p className="ok">{saved}</p> : null}
          <label>
            Shop name
            <input
              value={seller.name}
              onChange={(e) => setSeller({ ...seller, name: e.target.value })}
            />
          </label>
          <label>
            City
            <select
              value={seller.city}
              onChange={(e) => setSeller({ ...seller, city: e.target.value })}
            >
              {(cities.includes(seller.city) ? cities : [seller.city, ...cities]).map((city) => (
                <option key={city}>{city}</option>
              ))}
            </select>
          </label>
          <label>
            About your work
            <textarea
              value={seller.bio}
              onChange={(e) => setSeller({ ...seller, bio: e.target.value })}
            />
          </label>
          <label>
            WhatsApp
            <input
              value={seller.whatsapp}
              onChange={(e) => setSeller({ ...seller, whatsapp: e.target.value })}
            />
          </label>
          <label>
            Phone
            <input
              value={seller.phone}
              onChange={(e) => setSeller({ ...seller, phone: e.target.value })}
            />
          </label>
          <label>
            Email buyers can use
            <input
              value={seller.email_public}
              onChange={(e) => setSeller({ ...seller, email_public: e.target.value })}
            />
          </label>
          <label>
            Pickup notes
            <input
              value={seller.pickup_notes}
              onChange={(e) => setSeller({ ...seller, pickup_notes: e.target.value })}
            />
          </label>
          <label>
            Delivery notes
            <input
              value={seller.delivery_notes}
              onChange={(e) => setSeller({ ...seller, delivery_notes: e.target.value })}
            />
          </label>
          <button className="btn btn-clay" type="submit">
            Save profile
          </button>
        </form>

        <div>
          <h2>Listings</h2>
          {products.length === 0 ? (
            <div className="empty">
              <img src="/images/empty-listings.png" alt="" />
              No products yet. Add your first cake or craft.
            </div>
          ) : (
            products.map((product) => (
              <div className="table-row" key={product.id}>
                <img src={mediaUrl(product.image_url) || "/images/empty-listings.png"} alt="" />
                <div>
                  <strong>{product.name}</strong>
                  <div className="muted">{formatPrice(product.price)}</div>
                </div>
                <Link to={`/dashboard/edit/${product.id}`}>Edit</Link>
                <button className="btn btn-ghost" type="button" onClick={() => void removeProduct(product.id)}>
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
