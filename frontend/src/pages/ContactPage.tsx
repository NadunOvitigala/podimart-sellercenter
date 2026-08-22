import { useState, type FormEvent } from "react";
import { api } from "../api";

export function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSending(true);
    try {
      await api.contact({
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        source: "sellercenter",
      });
      setSent(true);
      setName("");
      setEmail("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="contact-page">
      <div className="wrap contact-wrap">
        <div className="contact-card">
          <header className="contact-card-head">
            <h1>Contact us</h1>
          </header>

          {sent ? (
            <p className="ok contact-feedback">Your message was sent. We will reply by email.</p>
          ) : null}
          {error ? <p className="error contact-feedback">{error}</p> : null}

          <form className="contact-form" onSubmit={(event) => void onSubmit(event)}>
            <div className="contact-form-row">
              <label>
                Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
            </div>
            <label>
              Message
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                required
              />
            </label>
            <button className="btn btn-clay contact-submit" type="submit" disabled={sending}>
              {sending ? "Sending…" : "Send message"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
