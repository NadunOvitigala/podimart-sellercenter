import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, getShopDraft, savePendingCover, setShopDraft } from "../api";
import { useAuth } from "../auth";
import {
  cognitoEnabled,
  confirmCognito,
  resendCognitoCode,
  signInCognito,
} from "../cognito";

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="field-label">{children}</span>;
}

export function ConfirmPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [params] = useSearchParams();
  const email = params.get("email") || "";
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const draft = useMemo(() => getShopDraft(), []);

  if (!cognitoEnabled) {
    return (
      <div className="auth-shell">
        <div className="auth-card auth-card-narrow">
          <header className="auth-card-head">
            <h1>Email confirmation</h1>
            <p className="auth-lede">Local mode does not need an email code. Log in instead.</p>
          </header>
          <Link className="btn btn-clay btn-auth-submit" to="/login">
            Log in
          </Link>
        </div>
      </div>
    );
  }

  async function openShop() {
    const token = await signInCognito(email, password);
    login(token);
    await api.bootstrap(
      draft || {
        name: email.split("@")[0] || "My shop",
        city: "Western Province",
        whatsapp: "",
        phone: "",
      },
    );
    await savePendingCover();
    setShopDraft(null);
    navigate("/dashboard");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setInfo("");
    try {
      if (code.trim()) {
        await confirmCognito(email, code);
      }
      await openShop();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm.");
    }
  }

  async function resend() {
    setError("");
    setInfo("");
    try {
      await resendCognitoCode(email);
      setInfo("A new code was sent to your email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend.");
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card auth-card-narrow">
        <header className="auth-card-head">
          <p className="auth-kicker">Almost there</p>
          <h1>Check your email</h1>
          <p className="auth-lede">
            We sent a code to <strong>{email || "your email"}</strong>. Enter it below with your
            password to open your shop. Already confirmed? Just enter your password.
          </p>
        </header>

        <form className="form auth-form" onSubmit={onSubmit}>
          {error ? <div className="error">{error}</div> : null}
          {info ? <div className="ok">{info}</div> : null}
          <label>
            <FieldLabel>Confirmation code</FieldLabel>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
            />
          </label>
          <label>
            <FieldLabel>Password</FieldLabel>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <button className="btn btn-clay btn-auth-submit" type="submit">
            Confirm and open shop
          </button>
          <button className="btn btn-outline btn-auth-secondary" type="button" onClick={() => void resend()}>
            Resend code
          </button>
        </form>
      </div>
    </div>
  );
}
