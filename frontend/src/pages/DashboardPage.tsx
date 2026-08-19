import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatPrice, mediaUrl, productCode } from "../api";
import { useAuth } from "../auth";
import { FilePicker } from "../components/FilePicker";
import { PUBLIC_URL } from "../sites";
import type { Product, Seller } from "../types";

function fileNameFromUrl(url: string): string {
  const last = url.split("?")[0].split("/").pop();
  if (!last) return "";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function firstShopName(name: string): string {
  return name.trim().split(/\s+/)[0] || "your";
}

export function DashboardPage() {
  const { token, ready, logout } = useAuth();
  const navigate = useNavigate();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [saved, setSaved] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverFileName, setCoverFileName] = useState("");
  const [confirmRemoveShop, setConfirmRemoveShop] = useState(false);
  const [removingShop, setRemovingShop] = useState(false);

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
        setCoverFileName(fileNameFromUrl(data.seller.avatar_url || ""));
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
        avatar_url: seller.avatar_url,
      });
      setSeller(updated);
      setSaved("Shop details saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  async function onCoverUpload(file: File) {
    if (!seller) return;
    setUploadingCover(true);
    setError("");
    try {
      const { url } = await api.upload(file);
      const updated = await api.updateMe({ avatar_url: url });
      setSeller(updated);
      setCoverFileName(file.name);
      setSaved("Shop cover photo saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload cover photo.");
    } finally {
      setUploadingCover(false);
    }
  }

  async function removeProduct(id: string) {
    if (!confirm("Remove this listing?")) return;
    await api.deleteProduct(id);
    setProducts((items) => items.filter((item) => item.id !== id));
  }

  async function removeShop() {
    setError("");
    setRemovingShop(true);
    try {
      await api.deleteShop();
      logout();
      navigate("/");
    } catch (err) {
      setRemovingShop(false);
      setConfirmRemoveShop(false);
      setError(err instanceof Error ? err.message : "Could not remove shop.");
    }
  }

  if (!seller) {
    return (
      <div className="wrap" style={{ paddingTop: 40 }}>
        {error ? <p className="error">{error}</p> : "Loading your shop…"}
      </div>
    );
  }

  const publicShop = `${PUBLIC_URL}/shop/${seller.slug}`;
  const coverUrl = mediaUrl(seller.avatar_url);

  return (
    <>
      <section
        className={`shop-cover${coverUrl ? " has-photo" : ""}`}
        style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
      >
        <div className="shop-cover-inner">
          <div className="wrap">
            <div className="section-head">
              <div>
                <h1>Welcome {firstShopName(seller.name)}'s Shop</h1>
                <p>
                  <a className="text-link" href={publicShop} target="_blank" rel="noreferrer">
                    View your shop
                  </a>
                </p>
              </div>
              <Link className="btn btn-clay" to="/dashboard/new">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M8 3v10M3 8h10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Add Product
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap" style={{ paddingTop: 28, paddingBottom: 40 }}>
      <div className="product-layout">
        <div className="stack-col">
        <form className="panel form" onSubmit={saveProfile}>
          <h2>Shop profile</h2>
          {error ? <div className="error">{error}</div> : null}
          {saved ? <p className="ok">{saved}</p> : null}
          <label>
            Shop Name
            <input
              value={seller.name}
              onChange={(e) => setSeller({ ...seller, name: e.target.value })}
            />
          </label>
          <label>
            Province
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
          <div className="file-field">
            <span>Shop Cover Photo</span>
            <FilePicker
              fileName={coverFileName}
              onFiles={(files) => void onCoverUpload(files[0])}
            />
            {uploadingCover ? <p className="muted">Uploading…</p> : null}
            <p className="muted">This photo is shown as the shop cover behind the welcome heading.</p>
          </div>
          <button className="btn btn-clay" type="submit">
            Save profile
          </button>
        </form>

        <section className="panel danger-panel">
          <h2>Remove shop</h2>
          <p className="muted">
            This removes your shop and all listings from Podimart Marketplace. Buyers will no longer
            see them. This cannot be undone.
          </p>
          <button className="btn btn-danger" type="button" onClick={() => setConfirmRemoveShop(true)}>
            Remove shop
          </button>
        </section>
        </div>

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
                <img
                  src={mediaUrl(product.image_url || product.image_urls?.[0]) || "/images/empty-listings.png"}
                  alt=""
                />
                <div>
                  <strong>{product.name}</strong>
                  <div className="muted">Product ID: {productCode(product)}</div>
                  <div className="muted">{formatPrice(product.price)}</div>
                </div>
                <Link className="btn btn-clay" to={`/dashboard/edit/${product.id}`}>
                  Edit
                </Link>
                <button className="btn btn-clay" type="button" onClick={() => void removeProduct(product.id)}>
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
    {confirmRemoveShop ? (
      <div
        className="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-shop-title"
      >
        <div className="modal-card">
          <h2 id="remove-shop-title">Remove this shop?</h2>
          <p>
            This will permanently remove <strong>{seller.name}</strong> and all listings from
            Podimart Marketplace. Buyers will no longer see them.
          </p>
          <p className="muted">This cannot be undone.</p>
          <div className="modal-actions">
            <button
              className="btn btn-outline"
              type="button"
              disabled={removingShop}
              onClick={() => setConfirmRemoveShop(false)}
            >
              No
            </button>
            <button
              className="btn btn-danger"
              type="button"
              disabled={removingShop}
              onClick={() => void removeShop()}
            >
              {removingShop ? "Removing…" : "Yes"}
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
