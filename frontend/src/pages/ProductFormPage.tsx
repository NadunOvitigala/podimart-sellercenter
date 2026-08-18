import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, mediaUrl } from "../api";
import { useAuth } from "../auth";
import type { Category, Product } from "../types";

const empty = {
  name: "",
  category: "bakery",
  price: "0",
  description: "",
  lead_time: "Order 2 days before",
  image_url: "",
};

export function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, ready } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!token) navigate("/login");
  }, [token, ready, navigate]);

  useEffect(() => {
    api.categories().then(setCategories).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!id) return;
    api.product(id).then(({ product }: { product: Product }) => {
      setForm({
        name: product.name,
        category: product.category,
        price: String(product.price),
        description: product.description,
        lead_time: product.lead_time,
        image_url: product.image_url,
      });
    });
  }, [id]);

  async function onUpload(file: File) {
    setUploading(true);
    setError("");
    try {
      const res = await api.upload(file);
      setForm((current) => ({ ...current, image_url: res.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const body = {
      name: form.name,
      category: form.category,
      price: Number(form.price) || 0,
      description: form.description,
      lead_time: form.lead_time,
      image_url: form.image_url,
    };
    try {
      if (id) await api.updateProduct(id, body);
      else await api.createProduct(body);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save product.");
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 640, paddingTop: 36 }}>
      <p>
        <Link to="/dashboard">Back to shop</Link>
      </p>
      <h1>{id ? "Edit product" : "Add a product"}</h1>
      <form className="form" onSubmit={onSubmit}>
        {error ? <div className="error">{error}</div> : null}
        <label>
          Name
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </label>
        <label>
          Category
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Price (Rs)
          <input
            type="number"
            min={0}
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
        </label>
        <label>
          Description
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label>
          Lead time
          <input
            value={form.lead_time}
            onChange={(e) => setForm({ ...form, lead_time: e.target.value })}
          />
        </label>
        <label>
          Photo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onUpload(file);
            }}
          />
        </label>
        {uploading ? <p className="muted">Uploading…</p> : null}
        {form.image_url ? (
          <img
            src={mediaUrl(form.image_url)}
            alt=""
            style={{ width: 220, height: 160, objectFit: "cover", borderRadius: 12 }}
          />
        ) : null}
        <button className="btn btn-clay" type="submit">
          Save listing
        </button>
      </form>
    </div>
  );
}
