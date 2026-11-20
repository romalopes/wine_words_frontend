import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { errorMessage } from "../utils/errors";
import Turnstile from "./Turnstile";

// Password reset page — reached from the "reset password" email link
// (/reset-password?reset_password_token=…). Sets the new password, is signed
// in automatically (the API issues a JWT), then redirects to the wines page.
function ResetPassword() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetPasswordToken = searchParams.get("reset_password_token") || "";

  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Turnstile state
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);

    if (!resetPasswordToken) {
      setError("This reset link is invalid or expired.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== passwordConfirmation) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword({
        reset_password_token: resetPasswordToken,
        password,
        password_confirmation: passwordConfirmation,
        turnstile_token: turnstileToken ?? undefined,
      });
      navigate("/wines", { replace: true });
    } catch (err) {
      setError(errorMessage(err, "Failed to reset password"));
      setSubmitting(false);
      setTurnstileReset((r) => r + 1);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="reset-title">
        <p className="wine-kicker">Account recovery</p>
        <h1 id="reset-title">Choose a new password</h1>
        <p className="auth-card__intro">
          Enter a new password for your account. You'll be signed in right away.
        </p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label className="auth-form__field">
            <span>New password</span>
            <input
              autoComplete="new-password"
              minLength={6}
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <label className="auth-form__field">
            <span>Confirm new password</span>
            <input
              autoComplete="new-password"
              minLength={6}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              required
              type="password"
              value={passwordConfirmation}
            />
          </label>

          {/* Turnstile verification */}
          <div className="auth-form__turnstile">
            <Turnstile
              siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
              action="password_reset"
              resetKey={turnstileReset}
              onToken={setTurnstileToken}
            />
          </div>

          {error ? (
            <p className="auth-form__error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            className="auth-form__submit"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Please wait..." : "Reset password"}
          </button>
        </form>

        <p className="auth-card__switch">
          <Link to="/login">Back to sign in</Link>
        </p>
      </section>
    </main>
  );
}

export default ResetPassword;