import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, displayPrice, formatPrice, mediaUrl, productCode } from "../api";
import { useAuth } from "../auth";
import { PUBLIC_URL } from "../sites";
import type { Category, Product, Seller } from "../types";

function firstShopName(name: string): string {
  return name.trim().split(/\s+/)[0] || "your";
}

function priceCell(product: Product): string {
  const variants = product.variants ?? [];
  if (variants.length > 1) {
    const prices = variants.map((item) => item.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return displayPrice(min);
    return `${formatPrice(min)} – ${formatPrice(max)}`;
  }
  if (variants.length === 1) return displayPrice(variants[0].price);
  return displayPrice(product.price);
}

function optionsCell(product: Product): string {
  const variants = product.variants ?? [];
  if (!variants.length) return "—";
  const kind = product.variation_type_label || "Options";
  return `${variants.length} ${kind.toLowerCase()}`;
}

function RowActions({
  productId,
  isActive,
  busy,
  onStatus,
  onRemove,
}: {
  productId: string;
  isActive: boolean;
  busy: boolean;
  onStatus: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="listings-actions" ref={ref}>
      <Link className="listings-action-link" to={`/dashboard/edit/${productId}`}>
        Edit
      </Link>
      <button
        type="button"
        className={open ? "listings-action-more is-open" : "listings-action-more"}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
      >
        {busy ? "…" : "More"}
        <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div className="listings-action-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onStatus();
            }}
          >
            {isActive ? "Disable listing" : "Enable listing"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="is-danger"
            onClick={() => {
              setOpen(false);
              onRemove();
            }}
          >
            Remove listing
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ListingsPage() {
  const { token, ready } = useAuth();
  const navigate = useNavigate();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    api.categories().then(setCategories).catch(() => undefined);
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

  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories) map.set(category.id, category.name);
    return map;
  }, [categories]);

  const allSelected = products.length > 0 && selected.length === products.length;
  const activeCount = products.filter((item) => (item.status || "active") === "active").length;

  const sorted = useMemo(
    () =>
      [...products].sort((a, b) =>
        String(b.created_at || "").localeCompare(String(a.created_at || "")),
      ),
    [products],
  );

  function toggleAll() {
    setSelected(allSelected ? [] : products.map((item) => item.id));
  }

  function toggleOne(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function removeProduct(id: string) {
    if (!confirm("Remove this listing?")) return;
    setBusyId(id);
    try {
      await api.deleteProduct(id);
      setProducts((items) => items.filter((item) => item.id !== id));
      setSelected((items) => items.filter((item) => item !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove listing.");
    } finally {
      setBusyId("");
    }
  }

  async function setStatus(id: string, status: "active" | "disabled") {
    setBusyId(id);
    setError("");
    try {
      const updated = await api.setProductStatus(id, status);
      setProducts((items) => items.map((item) => (item.id === id ? { ...item, ...updated } : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update listing status.");
    } finally {
      setBusyId("");
    }
  }

  async function removeSelected() {
    if (!selected.length) return;
    if (!confirm(`Remove ${selected.length} listing${selected.length === 1 ? "" : "s"}?`)) return;
    setError("");
    for (const id of selected) {
      try {
        await api.deleteProduct(id);
      } catch {
        setError("Some listings could not be removed.");
      }
    }
    setProducts((items) => items.filter((item) => !selected.includes(item.id)));
    setSelected([]);
  }

  if (!seller) {
    return (
      <div className="wrap" style={{ paddingTop: 40 }}>
        {error ? <p className="error">{error}</p> : "Loading your listings…"}
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
            </div>
          </div>
        </div>
      </section>

      <div className="wrap listings-page">
        <div className="listings-card">
          <div className="listings-toolbar">
            <div className="listings-toolbar-left">
              <h2>Listings</h2>
              <span className="listings-meta">
                Results: {sorted.length}
                {sorted.length > 0 ? ` · ${activeCount} active` : ""}
              </span>
            </div>
            <div className="listings-toolbar-actions">
              <Link className="btn btn-clay" to="/dashboard/new">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M8 3v10M3 8h10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Add listing
              </Link>
              <button
                className="btn btn-outline"
                type="button"
                disabled={!selected.length}
                onClick={() => void removeSelected()}
              >
                Remove selected
                {selected.length ? ` (${selected.length})` : ""}
              </button>
            </div>
          </div>

          {error ? <p className="error listings-error">{error}</p> : null}

          {sorted.length === 0 ? (
            <div className="listings-empty">
              <img src="/images/empty-listings.png" alt="" />
              <p>No listings yet. Add your first cake or craft.</p>
              <Link className="btn btn-clay" to="/dashboard/new">
                Add listing
              </Link>
            </div>
          ) : (
            <>
              <div className="listings-table-wrap listings-desktop">
                <table className="listings-table">
                  <thead>
                    <tr>
                      <th className="col-check">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          aria-label="Select all listings"
                        />
                      </th>
                      <th className="col-item">Item</th>
                      <th className="col-sku">Product ID</th>
                      <th className="col-price">Current price</th>
                      <th className="col-options">Options</th>
                      <th className="col-category">Category</th>
                      <th className="col-status">Status</th>
                      <th className="col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((product) => {
                      const thumb =
                        mediaUrl(product.image_url || product.image_urls?.[0]) ||
                        "/images/empty-listings.png";
                      const checked = selected.includes(product.id);
                      const isActive = (product.status || "active") === "active";
                      const rowBusy = busyId === product.id;
                      const categoryLabel =
                        categoryNames.get(product.category) || product.category || "—";
                      return (
                        <tr
                          key={product.id}
                          className={[
                            checked ? "is-selected" : "",
                            isActive ? "" : "is-disabled",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <td className="col-check">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleOne(product.id)}
                              aria-label={`Select ${product.name}`}
                            />
                          </td>
                          <td className="col-item">
                            <div className="listings-item">
                              <img src={thumb} alt="" />
                              <div className="listings-item-copy">
                                <Link
                                  className="listings-item-name"
                                  to={`/dashboard/edit/${product.id}`}
                                >
                                  {product.name}
                                </Link>
                                {isActive ? (
                                  <a
                                    className="listings-item-sub"
                                    href={`${PUBLIC_URL}/product/${product.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    View on marketplace
                                  </a>
                                ) : (
                                  <span className="listings-item-sub">
                                    Hidden from marketplace
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="col-sku">
                            <code className="listings-sku">{productCode(product)}</code>
                          </td>
                          <td className="col-price">{priceCell(product)}</td>
                          <td className="col-options">{optionsCell(product)}</td>
                          <td className="col-category">{categoryLabel}</td>
                          <td className="col-status">
                            <span
                              className={isActive ? "status-pill" : "status-pill is-disabled"}
                            >
                              {isActive ? "Active" : "Disabled"}
                            </span>
                          </td>
                          <td className="col-actions">
                            <RowActions
                              productId={product.id}
                              isActive={isActive}
                              busy={rowBusy}
                              onStatus={() =>
                                void setStatus(product.id, isActive ? "disabled" : "active")
                              }
                              onRemove={() => void removeProduct(product.id)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="listings-mobile">
                <div className="listings-mobile-select-all">
                  <label>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all listings"
                    />
                    Select all
                  </label>
                </div>
                {sorted.map((product) => {
                  const thumb =
                    mediaUrl(product.image_url || product.image_urls?.[0]) ||
                    "/images/empty-listings.png";
                  const checked = selected.includes(product.id);
                  const isActive = (product.status || "active") === "active";
                  const rowBusy = busyId === product.id;
                  const categoryLabel =
                    categoryNames.get(product.category) || product.category || "—";
                  return (
                    <article
                      key={product.id}
                      className={[
                        "listings-mobile-card",
                        checked ? "is-selected" : "",
                        isActive ? "" : "is-disabled",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div className="listings-mobile-top">
                        <label className="listings-mobile-check">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOne(product.id)}
                            aria-label={`Select ${product.name}`}
                          />
                        </label>
                        <img src={thumb} alt="" />
                        <div className="listings-mobile-copy">
                          <Link
                            className="listings-item-name"
                            to={`/dashboard/edit/${product.id}`}
                          >
                            {product.name}
                          </Link>
                          <span className="listings-mobile-price">{priceCell(product)}</span>
                          <span
                            className={isActive ? "status-pill" : "status-pill is-disabled"}
                          >
                            {isActive ? "Active" : "Disabled"}
                          </span>
                        </div>
                      </div>
                      <dl className="listings-mobile-meta">
                        <div>
                          <dt>ID</dt>
                          <dd>
                            <code className="listings-sku">{productCode(product)}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>Options</dt>
                          <dd>{optionsCell(product)}</dd>
                        </div>
                        <div>
                          <dt>Category</dt>
                          <dd>{categoryLabel}</dd>
                        </div>
                      </dl>
                      {isActive ? (
                        <a
                          className="listings-item-sub"
                          href={`${PUBLIC_URL}/product/${product.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View on marketplace
                        </a>
                      ) : (
                        <span className="listings-item-sub">Hidden from marketplace</span>
                      )}
                      <div className="listings-mobile-actions">
                        <RowActions
                          productId={product.id}
                          isActive={isActive}
                          busy={rowBusy}
                          onStatus={() =>
                            void setStatus(product.id, isActive ? "disabled" : "active")
                          }
                          onRemove={() => void removeProduct(product.id)}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
