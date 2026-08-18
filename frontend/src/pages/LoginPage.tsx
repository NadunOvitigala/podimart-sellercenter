import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, getShopDraft } from "../api";
import { useAuth } from "../auth";
import { cognitoEnabled, signInCognito } from "../cognito";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

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
              city: "Colombo",
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
    <div className="wrap" style={{ maxWidth: 480, paddingTop: 48 }}>
      <h1>Log in to Seller Center</h1>
      <p className="lede">Sellers only. Buyers shop on the public Podimart site.</p>
      <form className="form" onSubmit={onSubmit}>
        {error ? <div className="error">{error}</div> : null}
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        <button className="btn btn-clay" type="submit">
          Log in
        </button>
      </form>
      <p>
        New maker? <Link to="/signup">Open a free shop</Link>
      </p>
    </div>
  );
}
