import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, getShopDraft, setShopDraft } from "../api";
import { useAuth } from "../auth";
import {
  cognitoEnabled,
  confirmCognito,
  resendCognitoCode,
  signInCognito,
} from "../cognito";

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
      <div className="wrap" style={{ maxWidth: 480, paddingTop: 48 }}>
        <h1>Email confirmation</h1>
        <p className="lede">Local mode does not need an email code. Log in instead.</p>
        <Link to="/login">Log in</Link>
      </div>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await confirmCognito(email, code);
      const token = await signInCognito(email, password);
      login(token);
      await api.bootstrap(
        draft || {
          name: email.split("@")[0] || "My shop",
          city: "Colombo",
          whatsapp: "",
          phone: "",
        },
      );
      setShopDraft(null);
      navigate("/dashboard");
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
    <div className="wrap" style={{ maxWidth: 480, paddingTop: 48 }}>
      <h1>Check your email</h1>
      <p className="lede">
        Enter the code Cognito sent to <strong>{email || "your email"}</strong>, then your
        password to open the shop.
      </p>
      <form className="form" onSubmit={onSubmit}>
        {error ? <div className="error">{error}</div> : null}
        {info ? <div className="ok">{info}</div> : null}
        <label>
          Confirmation code
          <input value={code} onChange={(e) => setCode(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button className="btn btn-clay" type="submit">
          Confirm and open shop
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => void resend()}>
          Resend code
        </button>
      </form>
    </div>
  );
}
