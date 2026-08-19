import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { PUBLIC_URL } from "../sites";

export function Layout() {
  const navigate = useNavigate();
  const { token, logout } = useAuth();
  const loggedIn = Boolean(token);

  return (
    <>
      <header className="site-header">
        <div className="wrap header-row">
          <NavLink to="/" className="brand">
            <img src="/images/logo-sellercenter.png" alt="" />
            <span className="brand-text">
              <span className="brand-name">Seller Center</span>
              <span className="brand-mark">Podimart Marketplace</span>
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
                  <NavLink to="/dashboard">My Shop</NavLink>
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
                  <NavLink to="/login">Log in</NavLink>
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
        <div className="wrap">
          <strong className="serif">Podimart Seller Center</strong>
          <p>
            Manage your shop here. Buyers see your products on{" "}
            <a href={PUBLIC_URL}>Podimart Marketplace</a>.
          </p>
          <p>
            <NavLink to="/about">About us</NavLink>
            {" · "}
            <NavLink to="/contact">Contact us</NavLink>
          </p>
        </div>
      </footer>
    </>
  );
}
