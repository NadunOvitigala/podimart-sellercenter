import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, savePendingCover, setPendingCover, setShopDraft } from "../api";
import { useAuth } from "../auth";
import { FilePicker } from "../components/FilePicker";
import { cognitoEnabled, signUpCognito } from "../cognito";

export function SignupPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [cities, setCities] = useState<string[]>([]);
  const [error, setError] = useState("");
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

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (form.password !== form.passwordConfirm) {
      setError("Passwords do not match.");
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
        navigate(`/confirm?email=${encodeURIComponent(form.email)}`);
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
      setError(err instanceof Error ? err.message : "Could not create shop.");
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 520, paddingTop: 40 }}>
      <h1>Open a free shop</h1>
      <p className="lede">
        No website needed. Buyers will find you on Podimart Marketplace by category and province, then
        message you on WhatsApp.
      </p>
      <form className="form" onSubmit={onSubmit}>
        {error ? <div className="error">{error}</div> : null}
        <label>
          Shop Name
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="Maya's Home Cakes"
          />
        </label>
        <div className="file-field">
          <span>Shop Cover Photo</span>
          <FilePicker
            fileName={coverFileName}
            onFiles={(files) => {
              const file = files[0];
              setPendingCover(file ?? null);
              setCoverFileName(file?.name || "");
              setCoverPreview(file ? URL.createObjectURL(file) : "");
            }}
          />
        </div>
        {coverPreview ? (
          <img
            src={coverPreview}
            alt=""
            style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12 }}
          />
        ) : null}
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <label>
          Confirm Password
          <input
            type="password"
            value={form.passwordConfirm}
            onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <label>
          Province
          <select
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          >
            {cities.map((city) => (
              <option key={city}>{city}</option>
            ))}
          </select>
        </label>
        <label>
          WhatsApp Number
          <input
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            placeholder="0771234567"
          />
        </label>
        <label>
          Call number
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </label>
        <button className="btn btn-clay" type="submit">
          Create my shop
        </button>
      </form>
      <p>
        Already listed? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
