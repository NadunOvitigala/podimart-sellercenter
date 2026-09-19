import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, savePendingCover, setPendingCover, setShopDraft } from "../api";
import { useAuth } from "../auth";
import { FilePicker } from "../components/FilePicker";
import { cognitoEnabled, signInCognito, signUpCognito } from "../cognito";

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="field-label">
      {children}
      {required ? <span className="req" aria-hidden="true">*</span> : null}
    </span>
  );
}

export function SignupPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [cities, setCities] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [errorTick, setErrorTick] = useState(0);
  const errorRef = useRef<HTMLDivElement>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [coverFileName, setCoverFileName] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    passwordConfirm: "",
    city: "Western Province",
    whatsapp: "",
    phone: "",
  });

  useEffect(() => {
    api.cities().then(setCities).catch(() => undefined);
  }, []);

  function showError(message: string) {
    setError(message);
    setErrorTick((tick) => tick + 1);
  }

  useLayoutEffect(() => {
    if (!error) return;
    const node = errorRef.current;
    if (!node) return;
    const header = document.querySelector(".site-header");
    const headerHeight = header instanceof HTMLElement ? header.getBoundingClientRect().height : 0;
    const top = node.getBoundingClientRect().top + window.scrollY - headerHeight - 12;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
  }, [error, errorTick]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.name.trim()) {
      showError("Shop name is required.");
      return;
    }
    if (!form.email.trim()) {
      showError("Email is required.");
      return;
    }
    if (!form.password) {
      showError("Password is required.");
      return;
    }
    if (!form.passwordConfirm) {
      showError("Please confirm your password.");
      return;
    }
    if (form.password !== form.passwordConfirm) {
      showError("Passwords do not match.");
      return;
    }
    if (!form.city) {
      showError("Province is required.");
      return;
    }
    if (!form.whatsapp.trim()) {
      showError("WhatsApp number is required.");
      return;
    }
    if (!form.phone.trim()) {
      showError("Call number is required.");
      return;
    }
    try {
      if (cognitoEnabled) {
        setShopDraft({
          name: form.name,
          city: form.city,
          whatsapp: form.whatsapp,
          phone: form.phone,
        });
        await signUpCognito(form.email, form.password, form.name);
        const token = await signInCognito(form.email, form.password);
        login(token);
        await api.bootstrap({
          name: form.name,
          city: form.city,
          whatsapp: form.whatsapp,
          phone: form.phone,
        });
        await savePendingCover();
        setShopDraft(null);
        navigate("/dashboard");
        return;
      }
      const data = await api.signup({
        name: form.name,
        email: form.email,
        password: form.password,
        city: form.city,
        whatsapp: form.whatsapp,
        phone: form.phone,
      });
      login(data.token);
      await savePendingCover();
      navigate("/dashboard");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Could not create shop.");
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <header className="auth-card-head">
          <p className="auth-kicker">Free shop · WhatsApp orders</p>
          <h1>Open a free shop</h1>
          <p className="auth-lede">
            List on Podimart Marketplace. Buyers find you by category and province, then message
            you on WhatsApp.
          </p>
        </header>

        <form className="form auth-form" onSubmit={onSubmit}>
          {error ? (
            <div className="error" ref={errorRef} role="alert">
              {error}
            </div>
          ) : null}

          <section className="form-section">
            <h2 className="form-section-title">Shop details</h2>
            <label>
              <FieldLabel required>Shop name</FieldLabel>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Maya's Home Cakes"
                autoComplete="organization"
              />
            </label>

            <div className="auth-cover-field">
              <FieldLabel>Shop cover photo</FieldLabel>
              <p className="field-hint">Optional. Shown on your shop page in the marketplace.</p>
              <div className="auth-cover-box">
                {coverPreview ? (
                  <img className="auth-cover-preview" src={coverPreview} alt="" />
                ) : (
                  <div className="auth-cover-placeholder">
                    <span>JPG, PNG or WebP · up to 5 MB</span>
                  </div>
                )}
                <FilePicker
                  fileName={coverFileName}
                  emptyLabel="No photo chosen"
                  buttonLabel={coverPreview ? "Change photo" : "Choose photo"}
                  onFiles={(files) => {
                    const file = files[0];
                    setPendingCover(file ?? null);
                    setCoverFileName(file?.name || "");
                    setCoverPreview(file ? URL.createObjectURL(file) : "");
                  }}
                />
              </div>
            </div>

            <label>
              <FieldLabel required>Province</FieldLabel>
              <select
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                required
              >
                {cities.map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>
            </label>
          </section>

          <section className="form-section">
            <h2 className="form-section-title">Your account</h2>
            <label>
              <FieldLabel required>Email</FieldLabel>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <div className="form-row">
              <label>
                <FieldLabel required>Password</FieldLabel>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                />
              </label>
              <label>
                <FieldLabel required>Confirm password</FieldLabel>
                <input
                  type="password"
                  value={form.passwordConfirm}
                  onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
            </div>
          </section>

          <section className="form-section">
            <h2 className="form-section-title">Contact for buyers</h2>
            <p className="field-hint section-hint">
              Buyers will use these to reach you from your listings.
            </p>
            <div className="form-row">
              <label>
                <FieldLabel required>WhatsApp number</FieldLabel>
                <input
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="0771234567"
                  required
                  minLength={8}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </label>
              <label>
                <FieldLabel required>Call number</FieldLabel>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0771234567"
                  required
                  minLength={8}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </label>
            </div>
          </section>

          <button className="btn btn-clay btn-auth-submit" type="submit">
            Create my shop
          </button>
        </form>

        <p className="auth-switch">
          Already listed? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
