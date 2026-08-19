import { useState, type FormEvent } from "react";

const CONTACT_EMAIL = "hello@podimart.lk";

export function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const body = encodeURIComponent(`From: ${name}\n${email}\n\n${message}`);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Seller Center enquiry")}&body=${body}`;
  }

  return (
    <div className="wrap" style={{ maxWidth: 640, paddingTop: 40, paddingBottom: 48 }}>
      <h1>Contact us</h1>
      <p className="lede">
        Questions about opening a shop, listings, or your Seller Center account? Send us a
        message.
      </p>
      <div className="panel form" style={{ marginTop: 24 }}>
        <p>
          Email{" "}
          <a className="text-link" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
        <form className="form" onSubmit={onSubmit}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Message
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </label>
          <button className="btn btn-clay" type="submit">
            Send message
          </button>
        </form>
      </div>
    </div>
  );
}
