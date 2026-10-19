import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { emailVerificationsApi } from "../services/api";
import { errorData, errorMessage } from "../utils/errors";

type VerificationResult = Awaited<ReturnType<typeof emailVerificationsApi.verify>>;

// A verification URL consumes a one-time token. React Strict Mode deliberately
// recreates effects in development, so mounts for the same token must share the
// request rather than submit the token twice.
const verificationRequests = new Map<string, Promise<VerificationResult>>();

function verifyOnce(token: string): Promise<VerificationResult> {
  const existingRequest = verificationRequests.get(token);
  if (existingRequest) return existingRequest;

  const request = emailVerificationsApi.verify(token);
  verificationRequests.set(token, request);
  return request;
}

// /verify-email?token=... — the page the verification email links to. Consumes
// the token on mount and reports success/expired/invalid, offering a resend
// (with a fresh 24-hour window) when the link can no longer be used.
function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<{ status: string; message: string | null }>({
    status: "verifying",
    message: null,
  });
  const [resendEmail, setResendEmail] = useState(searchParams.get("email") || "");
  const [resendState, setResendState] = useState<{ status: string; message: string | null }>({
    status: "idle",
    message: null,
  });

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setState({ status: "invalid", message: "No verification token in the link." });
      return;
    }
    let cancelled = false;
    verifyOnce(token)
      .then((result) => {
        if (cancelled) return;
        setState({
          status: "verified",
          message: result.message || "Your email address is verified. You can sign in now.",
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const data = errorData(err);
        setState({
          status: data.email_verification_expired ? "expired" : "invalid",
          message: errorMessage(
            err,
            "This verification link is invalid or has expired.",
          ),
        });
      });
    return () => { cancelled = true; };
  }, [token]);

  async function handleResend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resendEmail.trim()) return;
    setResendState({ status: "sending", message: null });
    try {
      const result = await emailVerificationsApi.resend(resendEmail.trim());
      setResendState({
        status: "sent",
        message: result.message || "If an unverified account exists, a new verification email has been sent.",
      });
    } catch (err) {
      setResendState({
        status: "idle",
        message: errorMessage(err, "Could not send the email."),
      });
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="verify-title">
        <p className="wine-kicker">Email verification</p>
        <h1 id="verify-title">
          {state.status === "verifying" && "Verifying your email..."}
          {state.status === "verified" && "Email verified 🎉"}
          {state.status === "expired" && "Verification link expired"}
          {state.status === "invalid" && "Verification failed"}
        </h1>

        {state.message && <p className="auth-card__status">{state.message}</p>}

        {state.status === "verifying" && <p>Please wait a moment.</p>}

        {(state.status === "expired" || state.status === "invalid") && (
          <>
            <p>
              The link no longer works (it may have expired or already been used).
              Request a new verification email below — you then have 24 hours to
              click it.
            </p>
            <form onSubmit={handleResend}>
              <label>
                Email address
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  required
                />
              </label>
              <button className="auth-form__submit" disabled={resendState.status === "sending"} type="submit">
                {resendState.status === "sending" ? "Sending..." : "Resend verification email"}
              </button>
              {resendState.message && (
                <p className={resendState.status === "sent" ? "auth-card__status" : "auth-form__error"} role={resendState.status === "sent" ? "status" : "alert"}>
                  {resendState.message}
                </p>
              )}
            </form>
          </>
        )}

        {state.status === "verified" && (
          <p className="auth-card__switch">
            <Link className="text-link" to="/login">Go to sign in</Link>
          </p>
        )}

        <Link className="text-link" to="/wines">Back to wine list</Link>
      </section>
    </main>
  );
}

export default VerifyEmail;
