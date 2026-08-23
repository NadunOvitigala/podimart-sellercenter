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
          <span className="topbar-hide">Free shop · Listings · WhatsApp orders</span>
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
          <h2>More</h2>
          <button type="button" className="more-sheet-close" onClick={closeMenu}>
            Close
          </button>
        </div>
        <nav className="more-sheet-nav">
          {loggedIn ? (
            <>
              <p className="more-sheet-section-label">My shop</p>
              <NavLink to="/dashboard/listings" onClick={closeMenu}>
                My listings
              </NavLink>
              <NavLink to="/dashboard/new" onClick={closeMenu}>
                Add a product
              </NavLink>
              <NavLink to="/dashboard/profile" onClick={closeMenu}>
                Profile settings
              </NavLink>
            </>
          ) : null}
          <p className="more-sheet-section-label">Marketplace</p>
          <a href={PUBLIC_URL} onClick={closeMenu}>
            Browse podimart.lk
          </a>
          <NavLink to="/about" onClick={closeMenu}>
            About us
          </NavLink>
          <NavLink to="/contact" onClick={closeMenu}>
            Contact us
          </NavLink>
          {loggedIn ? (
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
          ) : null}
        </nav>
      </div>

      <main className="site-main">
        <Outlet />
      </main>

      {loggedIn ? (
        <nav className="mobile-tabbar" aria-label="Seller tools">
          <NavLink
            to="/dashboard/listings"
            className={({ isActive }) => (isActive ? "tabbar-item is-active" : "tabbar-item")}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 7h16M4 12h16M4 17h10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <span>Listings</span>
          </NavLink>
          <NavLink
            to="/dashboard/new"
            className={({ isActive }) =>
              isActive ? "tabbar-item is-active tabbar-primary" : "tabbar-item tabbar-primary"
            }
          >
            <span className="tabbar-fab" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </span>
            <span>Add</span>
          </NavLink>
          <NavLink
            to="/dashboard/profile"
            className={({ isActive }) => (isActive ? "tabbar-item is-active" : "tabbar-item")}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M5 19c1.8-3.2 4.2-4.8 7-4.8s5.2 1.6 7 4.8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <span>Profile</span>
          </NavLink>
          <button
            type="button"
            className={menuOpen ? "tabbar-item is-active" : "tabbar-item"}
            aria-expanded={menuOpen}
            aria-controls="seller-more"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 7h14M5 12h14M5 17h14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <span>More</span>
          </button>
        </nav>
      ) : (
        <nav className="mobile-tabbar" aria-label="Get started">
          <a className="tabbar-item" href={PUBLIC_URL}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            <span>Shop</span>
          </a>
          <NavLink
            to="/login"
            className={({ isActive }) => (isActive ? "tabbar-item is-active" : "tabbar-item")}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M15 12H3m0 0l3-3m-3 3l3 3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Log in</span>
          </NavLink>
          <NavLink
            to="/signup"
            className={({ isActive }) =>
              isActive ? "tabbar-item is-active tabbar-primary" : "tabbar-item tabbar-primary"
            }
          >
            <span className="tabbar-fab" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </span>
            <span>Sign up</span>
          </NavLink>
          <button
            type="button"
            className={menuOpen ? "tabbar-item is-active" : "tabbar-item"}
            aria-expanded={menuOpen}
            aria-controls="seller-more"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 7h14M5 12h14M5 17h14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <span>More</span>
          </button>
        </nav>
      )}

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
