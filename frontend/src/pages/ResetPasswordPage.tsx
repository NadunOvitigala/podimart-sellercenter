import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  cognitoEnabled,
  completePasswordReset,
  requestPasswordReset,
} from "../cognito";

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="field-label">
      {children}
      {required ? <span className="req" aria-hidden="true">*</span> : null}
    </span>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  if (!cognitoEnabled) {
    return (
      <div className="auth-shell">
        <div className="auth-card auth-card-narrow">
          <header className="auth-card-head">
            <h1>Reset password</h1>
            <p className="auth-lede">Password reset is only available on the live Seller Center.</p>
          </header>
          <Link className="btn btn-clay btn-auth-submit" to="/login">
            Back to log in
          </Link>
        </div>
      </div>
    );
  }

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    try {
      await requestPasswordReset(email.trim());
      setStep("confirm");
      setInfo(`We sent a reset code to ${email.trim()}. Check your inbox.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset code.");
    }
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    setInfo("");
    if (!code.trim()) {
      setError("Enter the code from your email.");
      return;
    }
    if (!password) {
      setError("Enter a new password.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await completePasswordReset(email.trim(), code.trim(), password);
      navigate(`/login?email=${encodeURIComponent(email.trim())}&reset=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.");
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card auth-card-narrow">
        <header className="auth-card-head">
          <p className="auth-kicker">Seller Center</p>
          <h1>Reset password</h1>
          <p className="auth-lede">
            {step === "request"
              ? "Enter your shop email and we will send you a reset code."
              : "Enter the code from your email and choose a new password."}
          </p>
        </header>

        {step === "request" ? (
          <form className="form auth-form" onSubmit={sendCode}>
            {error ? <div className="error">{error}</div> : null}
            {info ? <div className="ok">{info}</div> : null}
            <label>
              <FieldLabel required>Email</FieldLabel>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <button className="btn btn-clay btn-auth-submit" type="submit">
              Send reset code
            </button>
          </form>
        ) : (
          <form className="form auth-form" onSubmit={resetPassword}>
            {error ? <div className="error">{error}</div> : null}
            {info ? <div className="ok">{info}</div> : null}
            <label>
              <FieldLabel required>Email</FieldLabel>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoComplete="email"
              />
            </label>
            <label>
              <FieldLabel required>Reset code</FieldLabel>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                required
              />
            </label>
            <label>
              <FieldLabel required>New password</FieldLabel>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
              />
            </label>
            <label>
              <FieldLabel required>Confirm password</FieldLabel>
              <input
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
              />
            </label>
            <button className="btn btn-clay btn-auth-submit" type="submit">
              Reset password
            </button>
            <button
              className="btn btn-outline btn-auth-secondary"
              type="button"
              onClick={() => {
                setStep("request");
                setCode("");
                setPassword("");
                setPasswordConfirm("");
                setError("");
                setInfo("");
              }}
            >
              Send a new code
            </button>
          </form>
        )}

        <p className="auth-switch">
          Remember your password? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
