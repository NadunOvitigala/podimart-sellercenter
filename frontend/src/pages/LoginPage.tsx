import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, getShopDraft } from "../api";
import { useAuth } from "../auth";
import { cognitoEnabled, signInCognito } from "../cognito";

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="field-label">{children}</span>;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState(params.get("email") || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info] = useState(
    params.get("reset") === "1" ? "Password updated. Log in with your new password." : "",
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (cognitoEnabled) {
        const token = await signInCognito(email, password);
        login(token);
        try {
          await api.me();
        } catch {
          const draft = getShopDraft();
          await api.bootstrap(
            draft || {
              name: email.split("@")[0] || "My shop",
              city: "Western Province",
              whatsapp: "",
              phone: "",
            },
          );
        }
        navigate("/dashboard");
        return;
      }
      const data = await api.login(email, password);
      login(data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log in.");
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card auth-card-narrow">
        <header className="auth-card-head">
          <p className="auth-kicker">Seller Center</p>
          <h1>Log in</h1>
          <p className="auth-lede">Sellers only. Buyers shop on the public Podimart site.</p>
        </header>

        <form className="form auth-form" onSubmit={onSubmit}>
          {error ? <div className="error">{error}</div> : null}
          {info ? <div className="ok">{info}</div> : null}
          <label>
            <FieldLabel>Email</FieldLabel>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>
          <label>
            <FieldLabel>Password</FieldLabel>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          <p className="auth-forgot">
            <Link to={`/reset-password${email ? `?email=${encodeURIComponent(email)}` : ""}`}>
              Forgot password?
            </Link>
          </p>
          <button className="btn btn-clay btn-auth-submit" type="submit">
            Log in
          </button>
        </form>

        <p className="auth-switch">
          New maker? <Link to="/signup">Open a free shop</Link>
        </p>
      </div>
    </div>
  );
}
