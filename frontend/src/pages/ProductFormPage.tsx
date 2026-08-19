import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, mediaUrl, productCode } from "../api";
import { useAuth } from "../auth";
import { FilePicker } from "../components/FilePicker";
import type { Category, Product } from "../types";

const MAX_PHOTOS = 8;

const empty = {
  name: "",
  category: "bakery",
  subcategory: "",
  price: "0",
  description: "",
  lead_time: "Order 2 days before",
  image_urls: [] as string[],
};

function listingPhotos(product: Product): string[] {
  const urls = (product.image_urls ?? []).filter(Boolean);
  if (product.image_url && !urls.includes(product.image_url)) {
    return [product.image_url, ...urls];
  }
  return urls;
}

export function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, ready } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoFileNames, setPhotoFileNames] = useState("");
  const [listingCode, setListingCode] = useState("");

  const subcategories = useMemo(() => {
    const selected = categories.find((item) => item.id === form.category);
    return selected?.subcategories ?? [];
  }, [categories, form.category]);

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
        subcategory: product.subcategory || "",
        price: String(product.price),
        description: product.description,
        lead_time: product.lead_time,
        image_urls: listingPhotos(product),
      });
      setListingCode(productCode(product));
    });
  }, [id]);

  useEffect(() => {
    if (subcategories.length === 0) return;
    if (!subcategories.some((item) => item.id === form.subcategory)) {
      setForm((current) => ({ ...current, subcategory: subcategories[0].id }));
    }
  }, [form.subcategory, subcategories]);

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    const remaining = MAX_PHOTOS - form.image_urls.length;
    if (remaining <= 0) {
      setError(`You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    setUploading(true);
    setError("");
    try {
      const chosen = Array.from(files).slice(0, remaining);
      setPhotoFileNames(chosen.map((file) => file.name).join(", "));
      const uploaded: string[] = [];
      for (const file of chosen) {
        const res = await api.upload(file);
        uploaded.push(res.url);
      }
      setForm((current) => ({
        ...current,
        image_urls: [...current.image_urls, ...uploaded].slice(0, MAX_PHOTOS),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(url: string) {
    setForm((current) => ({
      ...current,
      image_urls: current.image_urls.filter((item) => item !== url),
    }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const body = {
      name: form.name,
      category: form.category,
      subcategory: form.subcategory,
      price: Number(form.price) || 0,
      description: form.description,
      lead_time: form.lead_time,
      image_url: form.image_urls[0] || "",
      image_urls: form.image_urls,
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
      {listingCode ? (
        <p className="muted">Product ID: {listingCode}</p>
      ) : (
        <p className="muted">A Product ID is created automatically when you save this listing.</p>
      )}
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
            onChange={(e) => setForm({ ...form, category: e.target.value, subcategory: "" })}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        {subcategories.length > 0 ? (
          <label>
            Subcategory
            <select
              value={form.subcategory}
              onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
              required
            >
              {subcategories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
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
        <div className="file-field">
          <span>Photos</span>
          <FilePicker
            multiple
            disabled={uploading || form.image_urls.length >= MAX_PHOTOS}
            fileName={photoFileNames}
            emptyLabel="No photos chosen"
            buttonLabel="Choose photos"
            onFiles={(files) => void onUpload(files)}
          />
        </div>
        <p className="muted">
          {form.image_urls.length}/{MAX_PHOTOS} photos. First photo is the cover.
        </p>
        {uploading ? <p className="muted">Uploading…</p> : null}
        {form.image_urls.length > 0 ? (
          <div className="photo-grid">
            {form.image_urls.map((url, index) => (
              <div className="photo-thumb" key={url}>
                <img src={mediaUrl(url)} alt="" />
                {index === 0 ? <span className="photo-cover">Cover</span> : null}
                <button
                  className="photo-remove"
                  type="button"
                  onClick={() => removePhoto(url)}
                  aria-label="Remove photo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <button className="btn btn-clay" type="submit">
          Save listing
        </button>
      </form>
    </div>
  );
}
