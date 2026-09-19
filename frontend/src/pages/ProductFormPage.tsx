import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, mediaUrl, productCode } from "../api";
import { useAuth } from "../auth";
import { FilePicker } from "../components/FilePicker";
import type { Category, Product } from "../types";

const MAX_PHOTOS = 8;
const MAX_VIDEOS = 2;

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
  delivery_charge: "0",
  delivery_note: "",
  offers_pickup: true,
  offers_delivery: true,
  image_urls: [] as string[],
  video_urls: [] as string[],
  payment_methods: ["cash_on_delivery", "bank_transfer"] as string[],
  variation_type: "size",
  variants: [] as VariantDraft[],
};

function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <span className="field-label-block">
      <span className="field-label">{children}</span>
      {hint ? <span className="field-hint">{hint}</span> : null}
    </span>
  );
}

function Panel({
  step,
  title,
  description,
  children,
}: {
  step: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="listing-panel">
      <div className="listing-panel-head">
        <span className="listing-step">{step}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="listing-panel-body">{children}</div>
    </section>
  );
}

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
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [photoFileNames, setPhotoFileNames] = useState("");
  const [videoFileNames, setVideoFileNames] = useState("");
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
        delivery_charge: String(product.delivery_charge ?? 0),
        delivery_note: product.delivery_note || "",
        offers_pickup: product.offers_pickup !== false,
        offers_delivery: product.offers_delivery !== false,
        image_urls: listingPhotos(product),
        video_urls: (product.video_urls ?? []).filter(Boolean),
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

  async function onUploadVideos(files: FileList | null) {
    if (!files?.length) return;
    const remaining = MAX_VIDEOS - form.video_urls.length;
    if (remaining <= 0) {
      setError(`You can add up to ${MAX_VIDEOS} short videos.`);
      return;
    }
    setUploadingVideo(true);
    setError("");
    try {
      const chosen = Array.from(files).slice(0, remaining);
      setVideoFileNames(chosen.map((file) => file.name).join(", "));
      const uploaded: string[] = [];
      for (const file of chosen) {
        const res = await api.upload(file);
        uploaded.push(res.url);
      }
      setForm((current) => ({
        ...current,
        video_urls: [...current.video_urls, ...uploaded].slice(0, MAX_VIDEOS),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video upload failed.");
    } finally {
      setUploadingVideo(false);
    }
  }

  function removeVideo(url: string) {
    setForm((current) => ({
      ...current,
      video_urls: current.video_urls.filter((item) => item !== url),
    }));
  }

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
      delivery_charge: Number(form.delivery_charge) || 0,
      delivery_note: form.delivery_note.trim(),
      offers_pickup: form.offers_pickup,
      offers_delivery: form.offers_delivery,
      image_url: form.image_urls[0] || "",
      image_urls: form.image_urls,
      video_urls: form.video_urls,
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
    <div className="wrap listing-form-page">
      <div className="listing-form-top">
        <Link className="listing-back" to="/dashboard/listings">
          ← Back to listings
        </Link>
        <header className="listing-form-header">
          <h1>{id ? "Edit product" : "Add a product"}</h1>
          <p className="listing-form-lede">
            {listingCode
              ? `Product ID ${listingCode}`
              : "Fill in each section below. Buyers will see this on podimart.lk."}
          </p>
        </header>
      </div>

      <form className="listing-form" onSubmit={onSubmit}>
        {error ? <div className="error listing-form-error">{error}</div> : null}

        <Panel step="1" title="Product details" description="Name, category, and description.">
          <label>
            <FieldLabel>Product name</FieldLabel>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Maya's chocolate cake"
            />
          </label>
          <div className="form-row">
            <label>
              <FieldLabel>Category</FieldLabel>
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
                <FieldLabel>Subcategory</FieldLabel>
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
          </div>
          <label>
            <FieldLabel hint="Tell buyers what makes this special.">Description</FieldLabel>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ingredients, sizes, flavours, custom options…"
              rows={4}
            />
          </label>
        </Panel>

        <Panel step="2" title="Price & delivery" description="What buyers pay and how you deliver.">
          {!hasVariants ? (
            <label>
              <FieldLabel>Price (Rs)</FieldLabel>
              <input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="1500"
              />
            </label>
          ) : (
            <p className="listing-inline-note">Price is set on each option in step 3.</p>
          )}
          <label>
            <FieldLabel hint="How early should buyers order?">Lead time</FieldLabel>
            <input
              value={form.lead_time}
              onChange={(e) => setForm({ ...form, lead_time: e.target.value })}
              placeholder="Order 2 days before"
            />
          </label>
          <div className="form-row">
            <label>
              <FieldLabel hint="Use 0 for free delivery.">Delivery fee (Rs)</FieldLabel>
              <input
                type="number"
                min={0}
                value={form.delivery_charge}
                onChange={(e) => setForm({ ...form, delivery_charge: e.target.value })}
              />
            </label>
            <label>
              <FieldLabel hint="Shown on the order page.">Delivery note</FieldLabel>
              <input
                value={form.delivery_note}
                onChange={(e) => setForm({ ...form, delivery_note: e.target.value })}
                placeholder="Colombo only · pickup available"
              />
            </label>
          </div>
          <div className="form-row fulfillment-row">
            <label className="check-label">
              <input
                type="checkbox"
                checked={form.offers_pickup}
                onChange={(e) => setForm({ ...form, offers_pickup: e.target.checked })}
              />
              Pickup available
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={form.offers_delivery}
                onChange={(e) => setForm({ ...form, offers_delivery: e.target.checked })}
              />
              Delivery available
            </label>
          </div>
        </Panel>

        <Panel
          step="3"
          title="Options"
          description="Optional — only if price changes by size, weight, or version."
        >
          {hasVariants ? (
            <label>
              <FieldLabel>Option type</FieldLabel>
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
                placeholder="Price (Rs)"
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
            className="btn btn-outline listing-add-option"
            type="button"
            onClick={addVariant}
            disabled={form.variants.length >= 20}
          >
            {hasVariants ? "+ Add another option" : "+ Add size / weight options"}
          </button>
        </Panel>

        <Panel step="4" title="Photos & videos" description="Show buyers what they will receive.">
          <div className="media-block">
            <div className="media-block-head">
              <FieldLabel hint={`${form.image_urls.length}/${MAX_PHOTOS} · first photo is the cover`}>
                Photos
              </FieldLabel>
              <FilePicker
                multiple
                disabled={uploading || form.image_urls.length >= MAX_PHOTOS}
                fileName={photoFileNames}
                emptyLabel=""
                buttonLabel="Add photos"
                onFiles={(files) => void onUpload(files)}
              />
            </div>
            {uploading ? <p className="field-hint">Uploading photos…</p> : null}
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
            ) : (
              <div className="media-empty">JPG, PNG or WebP · up to 5 MB each</div>
            )}
          </div>

          <div className="media-block">
            <div className="media-block-head">
              <FieldLabel hint={`${form.video_urls.length}/${MAX_VIDEOS} · optional short clips`}>
                Short videos
              </FieldLabel>
              <FilePicker
                accept="video/mp4,video/webm,video/quicktime"
                multiple
                disabled={uploadingVideo || form.video_urls.length >= MAX_VIDEOS}
                fileName={videoFileNames}
                emptyLabel=""
                buttonLabel="Add videos"
                onFiles={(files) => void onUploadVideos(files)}
              />
            </div>
            {uploadingVideo ? <p className="field-hint">Uploading video…</p> : null}
            {form.video_urls.length > 0 ? (
              <div className="photo-grid">
                {form.video_urls.map((url) => (
                  <div className="photo-thumb photo-thumb-video" key={url}>
                    <video src={mediaUrl(url)} muted playsInline preload="metadata" />
                    <span className="photo-cover">Video</span>
                    <button
                      className="photo-remove"
                      type="button"
                      onClick={() => removeVideo(url)}
                      aria-label="Remove video"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="media-empty">MP4, WebM or MOV · up to 30 sec · max 5 MB</div>
            )}
          </div>
        </Panel>

        <Panel step="5" title="Payment" description="How buyers can pay you.">
          <div className="payment-pills">
            {PAYMENT_OPTIONS.map((option) => {
              const selected = form.payment_methods.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  className={selected ? "payment-pill is-selected" : "payment-pill"}
                  onClick={() => togglePayment(option.id)}
                >
                  {selected ? "✓ " : ""}
                  {option.label}
                </button>
              );
            })}
          </div>
        </Panel>

        <div className="listing-form-actions">
          <button className="btn btn-clay" type="submit">
            Save listing
          </button>
          <Link className="btn btn-outline" to="/dashboard/listings">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
