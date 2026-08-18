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
            Seller Center
          </NavLink>
          <nav className="nav">
            <a href={PUBLIC_URL}>View marketplace</a>
            {loggedIn ? (
              <>
                <NavLink to="/dashboard">My shop</NavLink>
                <button
                  className="btn btn-ghost"
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
            <a href={PUBLIC_URL}>podimart.lk</a>.
          </p>
        </div>
      </footer>
    </>
  );
}
