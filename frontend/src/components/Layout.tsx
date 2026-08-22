import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { PUBLIC_URL } from "../sites";

export function Layout() {
  const navigate = useNavigate();
  const { token, logout } = useAuth();
  const loggedIn = Boolean(token);

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
          <NavLink to="/" className="brand">
            <img src="/images/logo-icon.png" alt="" />
            <span className="brand-text">
              <span className="brand-name">Seller Center</span>
              <span className="brand-mark">podimart.lk</span>
            </span>
          </NavLink>
          <nav className="nav">
            <div className="nav-links">
              <a href={PUBLIC_URL}>Marketplace</a>
              <NavLink to="/about">About us</NavLink>
              <NavLink to="/contact">Contact us</NavLink>
            </div>
            <div className="nav-actions">
              {loggedIn ? (
                <>
                  <NavLink to="/dashboard" className="nav-quiet">
                    My Shop
                  </NavLink>
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
                  <NavLink to="/signup" className="btn btn-clay">
                    Open a free shop
                  </NavLink>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>
      <main>
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
            <NavLink to="/dashboard">My shop</NavLink>
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
            <a href="mailto:hello@podimart.lk">hello@podimart.lk</a>
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
