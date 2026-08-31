import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { PUBLIC_URL } from "../sites";

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, logout } = useAuth();
  const loggedIn = Boolean(token);
  const [shopOpen, setShopOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const shopMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setShopOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!shopOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!shopMenuRef.current?.contains(event.target as Node)) {
        setShopOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setShopOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [shopOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.body.classList.add("menu-open");
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("menu-open");
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    setShopOpen(false);
  }

  return (
    <>
      <div className="topbar">
        <div className="wrap topbar-row">
          <span>Seller tools for home businesses on podimart.lk</span>
          <span className="topbar-hide">Free shop · Listings · Orders</span>
        </div>
      </div>
      <header className="site-header">
        <div className="wrap header-row">
          <NavLink to="/" className="brand" onClick={closeMenu}>
            <img src="/images/logo-icon.png" alt="" />
            <span className="brand-text">
              <span className="brand-name">Seller Center</span>
              <span className="brand-mark">podimart.lk</span>
            </span>
          </NavLink>
          <nav className="nav nav-desktop">
            <div className="nav-links">
              <a href={PUBLIC_URL}>Marketplace</a>
              <NavLink to="/about">About us</NavLink>
              <NavLink to="/contact">Contact us</NavLink>
            </div>
            <div className="nav-actions">
              {loggedIn ? (
                <>
                  <div className="nav-dropdown" ref={shopMenuRef}>
                    <button
                      type="button"
                      className={
                        shopOpen
                          ? "nav-quiet nav-dropdown-trigger is-open"
                          : "nav-quiet nav-dropdown-trigger"
                      }
                      aria-expanded={shopOpen}
                      aria-haspopup="menu"
                      onClick={() => setShopOpen((open) => !open)}
                    >
                      My Shop
                      <span className="nav-caret" aria-hidden="true">
                        ▾
                      </span>
                    </button>
                    {shopOpen ? (
                      <div className="nav-dropdown-menu" role="menu">
                        <NavLink
                          to="/dashboard/listings"
                          role="menuitem"
                          onClick={() => setShopOpen(false)}
                        >
                          Listings
                        </NavLink>
                        <NavLink
                          to="/dashboard/orders"
                          role="menuitem"
                          onClick={() => setShopOpen(false)}
                        >
                          Orders
                        </NavLink>
                        <NavLink
                          to="/dashboard/profile"
                          role="menuitem"
                          onClick={() => setShopOpen(false)}
                        >
                          Profile settings
                        </NavLink>
                      </div>
                    ) : null}
                  </div>
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() => {
                      logout();
                      navigate("/login");
                    }}
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/login" className="nav-quiet">
                    Log in
                  </NavLink>
                  <NavLink to="/signup" className="btn btn-clay nav-cta">
                    <span className="nav-cta-full">Open a free shop</span>
                    <span className="nav-cta-short">Open shop</span>
                  </NavLink>
                </>
              )}
            </div>
          </nav>
          <button
            type="button"
            className={menuOpen ? "nav-toggle is-open" : "nav-toggle"}
            aria-expanded={menuOpen}
            aria-controls="seller-more"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="nav-toggle-bars" aria-hidden="true" />
          </button>
        </div>
      </header>

      {menuOpen ? (
        <button
          type="button"
          className="more-sheet-backdrop"
          aria-label="Close menu"
          onClick={closeMenu}
        />
      ) : null}
      <div
        id="seller-more"
        className={menuOpen ? "more-sheet is-open" : "more-sheet"}
        role="dialog"
        aria-modal="true"
        aria-hidden={!menuOpen}
        aria-label="More menu"
      >
        <div className="more-sheet-head">
          <div>
            <h2>{loggedIn ? "My shop" : "Menu"}</h2>
            {loggedIn ? (
              <p className="more-sheet-subtitle">Manage listings, orders, and your shop profile.</p>
            ) : null}
          </div>
          <button type="button" className="more-sheet-close" onClick={closeMenu}>
            Close
          </button>
        </div>
        <nav className="more-sheet-nav">
          {loggedIn ? (
            <>
              <div className="more-sheet-group">
                <NavLink className="more-sheet-item" to="/dashboard/listings" onClick={closeMenu}>
                  <span className="more-sheet-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                      <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="more-sheet-item-copy">
                    <strong>Listings</strong>
                    <span>View and edit your products</span>
                  </span>
                </NavLink>
                <NavLink className="more-sheet-item" to="/dashboard/orders" onClick={closeMenu}>
                  <span className="more-sheet-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M6 6h14l-1.5 12H7.5L6 6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <path d="M9 10h6M9 14h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="more-sheet-item-copy">
                    <strong>Orders</strong>
                    <span>See new and confirmed orders</span>
                  </span>
                </NavLink>
                <NavLink className="more-sheet-item" to="/dashboard/profile" onClick={closeMenu}>
                  <span className="more-sheet-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
                      <path d="M5 20c1.2-3 4.4-5 7-5s5.8 2 7 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="more-sheet-item-copy">
                    <strong>Profile settings</strong>
                    <span>Shop name, photo, and contact</span>
                  </span>
                </NavLink>
              </div>

              <NavLink className="btn btn-clay more-sheet-cta" to="/dashboard/new" onClick={closeMenu}>
                + Add listing
              </NavLink>

              <p className="more-sheet-section-label">Marketplace &amp; help</p>
              <div className="more-sheet-links">
                <a href={PUBLIC_URL} onClick={closeMenu}>
                  View podimart.lk
                </a>
                <NavLink to="/about" onClick={closeMenu}>
                  About us
                </NavLink>
                <NavLink to="/contact" onClick={closeMenu}>
                  Contact us
                </NavLink>
              </div>

              <div className="more-sheet-foot">
                <button
                  className="more-sheet-logout"
                  type="button"
                  onClick={() => {
                    closeMenu();
                    logout();
                    navigate("/login");
                  }}
                >
                  Log out
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="more-sheet-section-label">Get started</p>
              <div className="more-sheet-links">
                <NavLink to="/" end onClick={closeMenu}>
                  Home
                </NavLink>
                <NavLink to="/login" onClick={closeMenu}>
                  Log in
                </NavLink>
                <NavLink to="/signup" onClick={closeMenu}>
                  Open a free shop
                </NavLink>
              </div>
              <p className="more-sheet-section-label">Marketplace &amp; help</p>
              <div className="more-sheet-links">
                <a href={PUBLIC_URL} onClick={closeMenu}>
                  View podimart.lk
                </a>
                <NavLink to="/about" onClick={closeMenu}>
                  About us
                </NavLink>
                <NavLink to="/contact" onClick={closeMenu}>
                  Contact us
                </NavLink>
              </div>
            </>
          )}
        </nav>
      </div>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="wrap footer-grid">
          <div>
            <NavLink to="/" className="brand footer-brand">
              <img src="/images/logo-icon.png" alt="" />
              <span className="brand-text">
                <span className="brand-name">Seller Center</span>
                <span className="brand-mark">podimart.lk</span>
              </span>
            </NavLink>
            <p>
              Manage your free shop, add listings, and reach buyers on podimart.lk. Buyers
              contact you on WhatsApp.
            </p>
          </div>
          <div>
            <h3>Seller tools</h3>
            <NavLink to="/dashboard/listings">Listings</NavLink>
            <NavLink to="/dashboard/orders">Orders</NavLink>
            <NavLink to="/dashboard/profile">Profile settings</NavLink>
            <NavLink to="/dashboard/new">Add a product</NavLink>
            <NavLink to="/signup">Open a free shop</NavLink>
          </div>
          <div>
            <h3>Marketplace</h3>
            <a href={PUBLIC_URL}>Browse podimart.lk</a>
            <a href={`${PUBLIC_URL}/browse`}>All listings</a>
          </div>
          <div>
            <h3>Help</h3>
            <NavLink to="/about">About us</NavLink>
            <NavLink to="/contact">Contact us</NavLink>
          </div>
        </div>
        <div className="wrap footer-bottom">
          <p>
            © {new Date().getFullYear()} podimart.lk · Seller Center · Free listings
          </p>
        </div>
      </footer>
    </>
  );
}
