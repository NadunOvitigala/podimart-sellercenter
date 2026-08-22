import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, mediaUrl } from "../api";
import { useAuth } from "../auth";
import { FilePicker } from "../components/FilePicker";
import { PUBLIC_URL } from "../sites";
import type { Seller } from "../types";

function fileNameFromUrl(url: string): string {
  const last = url.split("?")[0].split("/").pop();
  if (!last) return "";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function firstShopName(name: string): string {
  return name.trim().split(/\s+/)[0] || "your";
}

function displayValue(value: string, empty = "Not set"): string {
  return value.trim() ? value : empty;
}

export function ProfilePage() {
  const { token, ready, logout } = useAuth();
  const navigate = useNavigate();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [draft, setDraft] = useState<Seller | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [saved, setSaved] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverFileName, setCoverFileName] = useState("");
  const [confirmRemoveShop, setConfirmRemoveShop] = useState(false);
  const [removingShop, setRemovingShop] = useState(false);

  useEffect(() => {
    api.cities().then(setCities).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      navigate("/login");
      return;
    }
    api
      .me()
      .then((data) => {
        setSeller(data.seller);
        setDraft(data.seller);
        setCoverFileName(fileNameFromUrl(data.seller.avatar_url || ""));
      })
      .catch((err: Error) => {
        if (err.message.includes("finish creating")) {
          navigate("/signup");
          return;
        }
        setError(err.message);
      });
  }, [token, ready, navigate]);

  function startEditing() {
    if (!seller) return;
    setDraft({ ...seller });
    setCoverFileName(fileNameFromUrl(seller.avatar_url || ""));
    setError("");
    setSaved("");
    setEditing(true);
  }

  function cancelEditing() {
    if (!seller) return;
    setDraft({ ...seller });
    setCoverFileName(fileNameFromUrl(seller.avatar_url || ""));
    setError("");
    setSaved("");
    setEditing(false);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setError("");
    setSaved("");
    try {
      const updated = await api.updateMe({
        name: draft.name,
        city: draft.city,
        bio: draft.bio,
        whatsapp: draft.whatsapp,
        phone: draft.phone,
        email_public: draft.email_public,
        pickup_notes: draft.pickup_notes,
        delivery_notes: draft.delivery_notes,
        avatar_url: draft.avatar_url,
      });
      setSeller(updated);
      setDraft(updated);
      setCoverFileName(fileNameFromUrl(updated.avatar_url || ""));
      setSaved("Shop details saved.");
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  async function onCoverUpload(file: File) {
    if (!draft) return;
    setUploadingCover(true);
    setError("");
    try {
      const { url } = await api.upload(file);
      const updated = await api.updateMe({ avatar_url: url });
      setSeller(updated);
      setDraft(updated);
      setCoverFileName(file.name);
      setSaved("Shop cover photo saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload cover photo.");
    } finally {
      setUploadingCover(false);
    }
  }

  async function removeShop() {
    setError("");
    setRemovingShop(true);
    try {
      await api.deleteShop();
      logout();
      navigate("/");
    } catch (err) {
      setRemovingShop(false);
      setConfirmRemoveShop(false);
      setError(err instanceof Error ? err.message : "Could not remove shop.");
    }
  }

  if (!seller || !draft) {
    return (
      <div className="wrap" style={{ paddingTop: 40 }}>
        {error ? <p className="error">{error}</p> : "Loading profile…"}
      </div>
    );
  }

  const publicShop = `${PUBLIC_URL}/shop/${seller.slug}`;
  const coverUrl = mediaUrl(seller.avatar_url);

  return (
    <>
      <section
        className={`shop-cover${coverUrl ? " has-photo" : ""}`}
        style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
      >
        <div className="shop-cover-inner">
          <div className="wrap">
            <div className="section-head">
              <div>
                <h1>Profile settings</h1>
                <p>
                  {firstShopName(seller.name)}'s shop ·{" "}
                  <a className="text-link" href={publicShop} target="_blank" rel="noreferrer">
                    View your shop
                  </a>
                </p>
              </div>
              <Link className="btn btn-outline" to="/dashboard/listings">
                Back to listings
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap profile-page">
        {editing ? (
          <form className="panel form" onSubmit={saveProfile}>
            <div className="panel-head">
              <h2>Edit shop profile</h2>
              <button className="btn btn-outline" type="button" onClick={cancelEditing}>
                Cancel
              </button>
            </div>
            {error ? <div className="error">{error}</div> : null}
            {saved ? <p className="ok">{saved}</p> : null}
            <label>
              Shop Name
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Province
              <select
                value={draft.city}
                onChange={(e) => setDraft({ ...draft, city: e.target.value })}
              >
                {(cities.includes(draft.city) ? cities : [draft.city, ...cities]).map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>
            </label>
            <label>
              About your work
              <textarea
                value={draft.bio}
                onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              />
            </label>
            <label>
              WhatsApp
              <input
                value={draft.whatsapp}
                onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })}
              />
            </label>
            <label>
              Phone
              <input
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
            </label>
            <label>
              Email buyers can use
              <input
                value={draft.email_public}
                onChange={(e) => setDraft({ ...draft, email_public: e.target.value })}
              />
            </label>
            <label>
              Pickup notes
              <input
                value={draft.pickup_notes}
                onChange={(e) => setDraft({ ...draft, pickup_notes: e.target.value })}
              />
            </label>
            <label>
              Delivery notes
              <input
                value={draft.delivery_notes}
                onChange={(e) => setDraft({ ...draft, delivery_notes: e.target.value })}
              />
            </label>
            <div className="file-field">
              <span>Shop Cover Photo</span>
              <FilePicker
                fileName={coverFileName}
                onFiles={(files) => void onCoverUpload(files[0])}
              />
              {uploadingCover ? <p className="muted">Uploading…</p> : null}
              <p className="muted">
                This photo is shown as the shop cover behind the welcome heading.
              </p>
            </div>
            <button className="btn btn-clay" type="submit">
              Save profile
            </button>
          </form>
        ) : (
          <section className="panel">
            <div className="panel-head">
              <h2>Shop profile</h2>
              <button className="btn btn-clay" type="button" onClick={startEditing}>
                Edit
              </button>
            </div>
            {error ? <div className="error">{error}</div> : null}
            {saved ? <p className="ok">{saved}</p> : null}
            <dl className="profile-view">
              <div>
                <dt>Shop Name</dt>
                <dd>{seller.name}</dd>
              </div>
              <div>
                <dt>Province</dt>
                <dd>{seller.city}</dd>
              </div>
              <div className="profile-view-wide">
                <dt>About your work</dt>
                <dd>{displayValue(seller.bio, "No description yet.")}</dd>
              </div>
              <div>
                <dt>WhatsApp</dt>
                <dd>{displayValue(seller.whatsapp)}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{displayValue(seller.phone)}</dd>
              </div>
              <div>
                <dt>Email buyers can use</dt>
                <dd>{displayValue(seller.email_public)}</dd>
              </div>
              <div>
                <dt>Pickup notes</dt>
                <dd>{displayValue(seller.pickup_notes)}</dd>
              </div>
              <div>
                <dt>Delivery notes</dt>
                <dd>{displayValue(seller.delivery_notes)}</dd>
              </div>
              <div className="profile-view-wide">
                <dt>Shop Cover Photo</dt>
                <dd>
                  {coverUrl ? (
                    <img className="profile-cover-thumb" src={coverUrl} alt="" />
                  ) : (
                    "No cover photo yet."
                  )}
                </dd>
              </div>
            </dl>
          </section>
        )}

        <section className="panel danger-panel">
          <h2>Remove shop</h2>
          <p className="muted">
            This removes your shop and all listings from Podimart Marketplace. Buyers will no
            longer see them. This cannot be undone.
          </p>
          <button
            className="btn btn-danger"
            type="button"
            onClick={() => setConfirmRemoveShop(true)}
          >
            Remove shop
          </button>
        </section>
      </div>

      {confirmRemoveShop ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-shop-title"
        >
          <div className="modal-card">
            <h2 id="remove-shop-title">Remove this shop?</h2>
            <p>
              This will permanently remove <strong>{seller.name}</strong> and all listings from
              Podimart Marketplace. Buyers will no longer see them.
            </p>
            <p className="muted">This cannot be undone.</p>
            <div className="modal-actions">
              <button
                className="btn btn-outline"
                type="button"
                disabled={removingShop}
                onClick={() => setConfirmRemoveShop(false)}
              >
                No
              </button>
              <button
                className="btn btn-danger"
                type="button"
                disabled={removingShop}
                onClick={() => void removeShop()}
              >
                {removingShop ? "Removing…" : "Yes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
