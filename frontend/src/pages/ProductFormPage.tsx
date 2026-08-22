import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, mediaUrl, productCode } from "../api";
import { useAuth } from "../auth";
import { FilePicker } from "../components/FilePicker";
import type { Category, Product } from "../types";

const MAX_PHOTOS = 8;

const PAYMENT_OPTIONS = [
  { id: "cash_on_delivery", label: "Cash on delivery" },
  { id: "bank_transfer", label: "Bank transfer" },
] as const;

const VARIATION_TYPES = [
  { id: "size", label: "Size" },
  { id: "weight", label: "Weight" },
  { id: "version", label: "Version" },
  { id: "height", label: "Height" },
  { id: "other", label: "Other" },
] as const;

type VariantDraft = { id: string; label: string; price: string };

const empty = {
  name: "",
  category: "bakery",
  subcategory: "",
  price: "0",
  description: "",
  lead_time: "Order 2 days before",
  image_urls: [] as string[],
  payment_methods: ["cash_on_delivery", "bank_transfer"] as string[],
  variation_type: "size",
  variants: [] as VariantDraft[],
};

function listingPhotos(product: Product): string[] {
  const urls = (product.image_urls ?? []).filter(Boolean);
  if (product.image_url && !urls.includes(product.image_url)) {
    return [product.image_url, ...urls];
  }
  return urls;
}

function newVariant(): VariantDraft {
  return { id: "", label: "", price: "0" };
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

  const hasVariants = form.variants.length > 0;

  useEffect(() => {
    if (!ready) return;
    if (!token) navigate("/login");
  }, [token, ready, navigate]);

  useEffect(() => {
    api.categories().then(setCategories).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!id) return;
    api.me().then((data) => {
      const product = data.products.find((item) => item.id === id);
      if (!product) {
        setError("Product not found.");
        return;
      }
      setForm({
        name: product.name,
        category: product.category,
        subcategory: product.subcategory || "",
        price: String(product.price),
        description: product.description,
        lead_time: product.lead_time,
        image_urls: listingPhotos(product),
        payment_methods: product.payment_methods?.length ? product.payment_methods : [],
        variation_type: product.variation_type || "size",
        variants: (product.variants ?? []).map((item) => ({
          id: item.id,
          label: item.label,
          price: String(item.price),
        })),
      });
      setListingCode(productCode(product));
    }).catch((err: Error) => setError(err.message));
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

  function togglePayment(method: string) {
    setForm((current) => {
      const selected = current.payment_methods.includes(method)
        ? current.payment_methods.filter((item) => item !== method)
        : [...current.payment_methods, method];
      return { ...current, payment_methods: selected };
    });
  }

  function updateVariant(index: number, patch: Partial<VariantDraft>) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function addVariant() {
    setForm((current) => ({
      ...current,
      variants: [...current.variants, newVariant()].slice(0, 20),
    }));
  }

  function removeVariant(index: number) {
    setForm((current) => ({
      ...current,
      variants: current.variants.filter((_, i) => i !== index),
    }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (form.payment_methods.length === 0) {
      setError("Please choose at least one payment method.");
      return;
    }
    const variants = form.variants
      .map((item) => ({
        id: item.id,
        label: item.label.trim(),
        price: Number(item.price) || 0,
      }))
      .filter((item) => item.label);
    if (form.variants.length > 0 && variants.length === 0) {
      setError("Add a label for each option, or remove empty options.");
      return;
    }
    const body = {
      name: form.name,
      category: form.category,
      subcategory: form.subcategory,
      price: Number(form.price) || 0,
      description: form.description,
      lead_time: form.lead_time,
      image_url: form.image_urls[0] || "",
      image_urls: form.image_urls,
      payment_methods: form.payment_methods,
      variation_type: form.variation_type,
      variants,
    };
    try {
      if (id) await api.updateProduct(id, body);
      else await api.createProduct(body);
      navigate("/dashboard/listings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save product.");
    }
  }

  return (
    <div className="wrap form-page">
      <p>
        <Link to="/dashboard/listings">Back to listings</Link>
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
        {!hasVariants ? (
          <label>
            Price (Rs)
            <input
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </label>
        ) : (
          <p className="muted">Price comes from each option below.</p>
        )}
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

        <fieldset className="variant-field">
          <legend>Options (size / weight / version)</legend>
          <p className="muted variant-help">
            Optional. Add options if this product has different prices (for example 1kg / 2kg).
          </p>
          {hasVariants ? (
            <label>
              Option type
              <select
                value={form.variation_type}
                onChange={(e) => setForm({ ...form, variation_type: e.target.value })}
              >
                {VARIATION_TYPES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {form.variants.map((variant, index) => (
            <div className="variant-row" key={`variant-${index}`}>
              <input
                placeholder="Label (e.g. 1 kg)"
                value={variant.label}
                onChange={(e) => updateVariant(index, { label: e.target.value })}
                required={hasVariants}
              />
              <input
                type="number"
                min={0}
                placeholder="Price"
                value={variant.price}
                onChange={(e) => updateVariant(index, { price: e.target.value })}
                required={hasVariants}
              />
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => removeVariant(index)}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            className="btn btn-outline"
            type="button"
            onClick={addVariant}
            disabled={form.variants.length >= 20}
          >
            {hasVariants ? "Add another option" : "Add size / weight / version options"}
          </button>
        </fieldset>

        <fieldset className="check-field">
          <legend>Allowed payment methods</legend>
          {PAYMENT_OPTIONS.map((option) => (
            <label key={option.id} className="check-option">
              <input
                type="checkbox"
                checked={form.payment_methods.includes(option.id)}
                onChange={() => togglePayment(option.id)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
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
