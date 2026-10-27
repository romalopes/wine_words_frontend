import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { invitationsApi } from "../services/api";
import type { InvitationValidationResponse } from "../types/user";
import { errorMessage } from "../utils/errors";

export default function AcceptInvitation() {
  const location = useLocation();
  const token = new URLSearchParams(location.hash.replace(/^#/, "")).get("token") ?? "";
  const [validation, setValidation] = useState<InvitationValidationResponse | null>(null);
  const [status, setStatus] = useState<"validating" | "ready" | "invalid" | "accepted">("validating");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("invalid"); setMessage("This invitation link is invalid or has expired."); return; }
    invitationsApi.validate(token).then((result) => {
      setValidation(result); setStatus("ready");
    }).catch((err) => { setStatus("invalid"); setMessage(errorMessage(err, "This invitation link is invalid or has expired.")); });
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 6) { setMessage("Password must be at least 6 characters long."); return; }
    if (password !== confirmation) { setMessage("Passwords do not match."); return; }
    setSubmitting(true); setMessage(null);
    try {
      const result = await invitationsApi.accept({ token, password, password_confirmation: confirmation });
      setMessage(result.message); setStatus("accepted");
    } catch (err) {
      setMessage(errorMessage(err, "Could not accept this invitation."));
    } finally { setSubmitting(false); }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="invitation-title">
        <p className="wine-kicker">Account invitation</p>
        <h1 id="invitation-title">{status === "accepted" ? "Account activated" : "Join Wine Words"}</h1>
        {status === "validating" && <p>Checking your invitation…</p>}
        {status === "invalid" && <><p className="auth-form__error" role="alert">{message}</p><Link to="/login">Go to sign in</Link></>}
        {status === "ready" && validation && (
          <>
            <p>Welcome {validation.invitation.display_name || "to Wine Words"}. This invitation is for {validation.invitation.email}.</p>
            <form className="auth-form" onSubmit={submit}>
              <label className="auth-form__field"><span>Password</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
              <label className="auth-form__field"><span>Confirm password</span><input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>
              {message && <p className="auth-form__error" role="alert">{message}</p>}
              <button className="auth-form__submit" disabled={submitting} type="submit">{submitting ? "Activating..." : "Activate account"}</button>
            </form>
          </>
        )}
        {status === "accepted" && <><p className="auth-card__status">{message}</p><Link to="/login">Sign in</Link></>}
      </section>
    </main>
  );
}