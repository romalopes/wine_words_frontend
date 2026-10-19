import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authApi, emailVerificationsApi } from "../services/api";
import type { SocialProvider } from "../types/api";
import type {
  EmailVerification,
  SignUpResponse,
  User,
} from "../types/authentication";
import { errorData, errorMessage, errorStatus } from "../utils/errors";
import {
  PROVIDER_LABELS,
  ProviderCancelledError,
  ProviderConfigurationError,
  availableProviders,
  signInWith,
} from "../services/socialProviders";

/** Which set of fields the card is showing. */
type AuthMode = "signIn" | "signUp" | "forgot";

/** The four fields the card edits, shared by all three modes. */
interface LoginForm {
  email: string;
  password: string;
  password_confirmation: string;
  first_name: string;
  last_name: string;
}

const initialForm: LoginForm = {
  email: "",
  password: "",
  password_confirmation: "",
  first_name: "",
  last_name: "",
};

/**
 * The "check your inbox" banner state. Set when the backend confirms the
 * account exists but is not email-verified, so no session was issued.
 */
interface VerificationNotice {
  email: string;
  expired: boolean;
  deadline: string | null;
}

/** Progress of the "resend verification email" button. */
interface ResendState {
  status: "idle" | "sending" | "sent";
  message: string | null;
}

/**
 * `signUp` hands back either a signed-in `User` or the full `SignUpResponse`
 * (the account exists, but no session was issued). Pull the verification
 * sub-object out of whichever arrived, returning null when there isn't one.
 * `User` carries an index signature, so this reads the field rather than
 * narrowing on `in` — which would collapse to `{}`.
 */
function readEmailVerification(
  result: User | SignUpResponse,
): EmailVerification | null {
  const verification = (result as SignUpResponse).email_verification;
  return verification ?? null;
}

// Minimal brand marks, sized by .auth-card__social-btn svg. Kept inline so the
// buttons work with no icon dependency.
const PROVIDER_ICONS: Record<SocialProvider, React.ReactNode> = {
  google: (
    <svg aria-hidden="true" height="18" viewBox="0 0 18 18" width="18">
      <path
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  ),
  apple: (
    <svg aria-hidden="true" height="18" viewBox="0 0 18 18" width="18">
      <path
        d="M13.05 9.54c.02 2.2 1.93 2.93 1.96 2.94-.02.06-.31 1.06-1.02 2.1-.61.9-1.25 1.79-2.25 1.81-.98.02-1.3-.58-2.42-.58-1.13 0-1.48.56-2.42.6-.97.03-1.71-.97-2.33-1.86C3.28 12.7 2.28 9.02 3.6 6.62c.65-1.19 1.82-1.94 3.09-1.96.97-.02 1.88.65 2.42.65.54 0 1.55-.8 2.62-.68.45.02 1.7.18 2.5 1.36-.06.04-1.5.87-1.48 2.6M11.28 3.6c.48-.58.8-1.38.71-2.18-.69.03-1.52.46-2.01 1.03-.44.51-.83 1.33-.73 2.11.77.06 1.55-.39 2.03-.96"
        fill="#111"
      />
    </svg>
  ),
  microsoft: (
    <svg aria-hidden="true" height="18" viewBox="0 0 18 18" width="18">
      <path d="M1 1h7.6v7.6H1z" fill="#F25022" />
      <path d="M9.4 1H17v7.6H9.4z" fill="#7FBA00" />
      <path d="M1 9.4h7.6V17H1z" fill="#00A4EF" />
      <path d="M9.4 9.4H17V17H9.4z" fill="#FFB900" />
    </svg>
  ),
  facebook: (
    <svg aria-hidden="true" height="18" viewBox="0 0 18 18" width="18">
      <path
        d="M18 9a9 9 0 1 0-10.4 8.9v-6.3H5.3V9h2.3V7c0-2.3 1.4-3.6 3.4-3.6.98 0 2 .17 2 .17v2.2h-1.13c-1.11 0-1.46.7-1.46 1.4V9h2.5l-.4 2.6h-2.1v6.3A9 9 0 0 0 18 9Z"
        fill="#1877F2"
      />
    </svg>
  ),
};

function Login() {
  const { user, signIn, signUp, socialSignIn } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [form, setForm] = useState<LoginForm>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set when the backend says the account exists but is not email-verified:
  // { email, expired, deadline } → the "check your inbox" banner replaces the
  // form and offers a resend.
  const [verificationNotice, setVerificationNotice] =
    useState<VerificationNotice | null>(null);
  const [resendState, setResendState] = useState<ResendState>({
    status: "idle",
    message: null,
  });
  // Provider whose popup is currently open, so only that button shows as busy.
  const [pendingProvider, setPendingProvider] = useState<SocialProvider | null>(
    null,
  );

  const isSignUp = mode === "signUp";
  const isForgot = mode === "forgot";
  // Only providers with a client id configured for this build are offered;
  // the same backend still validates the credential.
  const providers = availableProviders();
  const navigate = useNavigate();
  const location = useLocation();
  // Callers (e.g. /subscribe) pass `state: { from }` so sign-in returns the
  // visitor where they came from. Only same-origin in-app paths are honoured —
  // anything else falls back to the wines list.
  const requestedFrom = (location.state as { from?: unknown } | null)?.from;
  const returnTo =
    typeof requestedFrom === "string" &&
    requestedFrom.startsWith("/") &&
    !requestedFrom.startsWith("//")
      ? requestedFrom
      : "/wines";

  function updateField(field: keyof LoginForm) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };
  }

  function toggleMode(nextMode: AuthMode) {
    setMode(nextMode);
    setFormError(null);
    setSuccess(null);
    setForm(initialForm);
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setSuccess(null);

    try {
      const { email, password, password_confirmation, first_name, last_name } =
        form;

      if (isForgot) {
        if (!email) {
          setFormError("Enter your account email.");
          return;
        }
        const result = await authApi.forgotPassword(email);
        setSuccess(result.message || "Reset instructions sent.");
        setForm(initialForm);
        return;
      }

      if (!email || !password) {
        setFormError("Email and password are required.");
        return;
      }
      if (isSignUp && (!first_name.trim() || !last_name.trim())) {
        setFormError("First name and last name are required.");
        return;
      }
      if (
        isSignUp &&
        (first_name.trim().length > 80 || last_name.trim().length > 80)
      ) {
        setFormError(
          "First name and last name must each be 80 characters or fewer.",
        );
        return;
      }
      if (isSignUp && password.length < 6) {
        setFormError("Password must be at least 6 characters long.");
        return;
      }
      if (isSignUp && password !== password_confirmation) {
        setFormError("Passwords do not match.");
        return;
      }

      if (isSignUp) {
        const result = await signUp({
          email,
          password,
          password_confirmation,
          first_name: first_name.trim(),
          last_name: last_name.trim(),
        });
        // Email verification required: the account exists but has no session.
        // Show the "check your inbox" banner with the verification deadline.
        // `signUp` returns the user on success, or the whole response when the
        // backend withheld the session pending verification. Narrow on the flag
        // itself rather than assuming which shape came back.
        const verification = readEmailVerification(result);
        if (verification?.email_verification_pending) {
          setVerificationNotice({
            email,
            expired: verification.email_verification_expired === true,
            deadline: verification.email_verification_deadline ?? null,
          });
          setResendState({ status: "idle", message: null });
          return;
        }
      } else {
        await signIn({ email, password });
      }

      navigate(returnTo, { replace: true });
    } catch (error) {
      console.error(error);
      // Sign-in blocked by the email-verification lock (403 + payload).
      const data = errorData(error);
      if (errorStatus(error) === 403 && data.email_verification_pending) {
        const deadline = data.email_verification_deadline;
        setVerificationNotice({
          email: form.email,
          expired: data.email_verification_expired === true,
          deadline: typeof deadline === "string" ? deadline : null,
        });
        setResendState({ status: "idle", message: null });
        return;
      }
      setFormError(errorMessage(error, "Could not sign you in."));
    } finally {
      setIsSubmitting(false);
    }
  };

  async function handleResendVerification() {
    if (!verificationNotice?.email) return;
    setResendState({ status: "sending", message: null });
    try {
      const result = await emailVerificationsApi.resend(
        verificationNotice.email,
      );
      // A fresh link was issued, so the notice is live again. Read from the
      // already-narrowed value rather than the updater's `prev`, which is
      // nullable (the banner can be dismissed while the request is in flight).
      setVerificationNotice({ ...verificationNotice, expired: false });
      setResendState({
        status: "sent",
        message:
          result.message ||
          "A new verification email has been sent. Check your inbox — you have 24 hours to click the link.",
      });
    } catch (err) {
      setResendState({
        status: "idle",
        message: errorMessage(err, "Could not send the email."),
      });
    }
  }

  // Human-readable time remaining until the verification deadline.
  function describeTimeRemaining(deadline: string | null): string {
    if (!deadline) return "24 hours";
    const secondsLeft = Math.floor(
      (new Date(deadline).getTime() - Date.now()) / 1000,
    );
    if (secondsLeft <= 0) return "the link has expired";
    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    return hours > 0
      ? `${hours} hour${hours === 1 ? "" : "s"}${minutes ? ` and ${minutes} min` : ""}`
      : `${minutes} min`;
  }
  // "Continue with <provider>": run the provider's popup, then hand the
  // provider-issued credential to the API. The API verifies it and returns the
  // same session payload as email/password, so nothing after this point needs
  // to know how the person signed in.
  const handleSocial = async (provider: SocialProvider) => {
    setFormError(null);
    setSuccess(null);
    setPendingProvider(provider);

    try {
      const { credential, nonce } = await signInWith(provider);
      await socialSignIn(provider, { credential, nonce });
      navigate(returnTo, { replace: true });
    } catch (error) {
      // Closing the popup is a normal thing to do, not a failure. A
      // misconfigured provider (e.g. an unauthorised Google origin) IS a
      // failure worth showing, with the actionable detail attached.
      if (error instanceof ProviderConfigurationError) {
        console.error(error);
        setFormError(error.message);
      } else if (!(error instanceof ProviderCancelledError)) {
        console.error(error);
        setFormError(
          errorMessage(
            error,
            `Could not sign in with ${PROVIDER_LABELS[provider]}.`,
          ),
        );
      }
    } finally {
      setPendingProvider(null);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        {user ? (
          <p className="auth-card__status">
            You are already signed in as {user.email}.
          </p>
        ) : verificationNotice ? (
          <>
            <p className="wine-kicker">Verify your email</p>
            <h1 id="auth-title">Check your inbox</h1>
            <p className="auth-card__intro">
              <strong>One click away</strong> — we just need to know it&rsquo;s
              really you.
            </p>
            <p className="auth-card__status">
              We sent a verification link to{" "}
              <strong>{verificationNotice.email}</strong>.
              {verificationNotice.expired
                ? " Your previous link has expired, so the account is locked until you verify."
                : ` You have ${describeTimeRemaining(verificationNotice.deadline)} to click the link — after that the account is locked until you verify.`}
            </p>
            <ol className="auth-card__steps">
              <li>Open your inbox</li>
              <li>Locate our verification email</li>
              <li>Click the verification link</li>
            </ol>
            <p className="auth-card__hint">
              No email yet? Check your spam folder.
            </p>
            <button
              className="auth-form__submit"
              disabled={resendState.status === "sending"}
              onClick={handleResendVerification}
              type="button"
            >
              {resendState.status === "sending"
                ? "Sending..."
                : "Resend verification email"}
            </button>
            {resendState.message && (
              <p
                className={
                  resendState.status === "sent"
                    ? "auth-card__status"
                    : "auth-form__error"
                }
                role={resendState.status === "sent" ? "status" : "alert"}
              >
                {resendState.message}
              </p>
            )}
            <p className="auth-card__switch">
              <button
                onClick={() => {
                  setVerificationNotice(null);
                  setResendState({ status: "idle", message: null });
                }}
                type="button"
              >
                Back to sign in
              </button>
            </p>
          </>
        ) : (
          <>
            <p className="wine-kicker">
              {isForgot
                ? "Account recovery"
                : isSignUp
                  ? "Create account"
                  : "Welcome back"}
            </p>
            <h1 id="auth-title">
              {isForgot
                ? "Reset your password"
                : isSignUp
                  ? "Join Wine Words"
                  : "Sign in to Wine Words"}
            </h1>
            <p className="auth-card__intro">
              {isForgot
                ? "Enter your account email and we'll send you a link to set a new password."
                : isSignUp
                  ? "Save tasting profiles, track the wines you have tried, and sync your quiz results across devices."
                  : "Access your saved tasting profiles and continue where you left off in the quiz."}
            </p>

            {success ? (
              <p className="auth-card__status">{success}</p>
            ) : (
              <form className="auth-form" onSubmit={handleSubmit} noValidate>
                {isSignUp && !isForgot ? (
                  <>
                    <label className="auth-form__field">
                      <span>First name</span>
                      <input
                        autoComplete="given-name"
                        name="first_name"
                        onChange={updateField("first_name")}
                        type="text"
                        value={form.first_name}
                        maxLength={80}
                        required
                      />
                    </label>
                    <label className="auth-form__field">
                      <span>Last name</span>
                      <input
                        autoComplete="family-name"
                        name="last_name"
                        onChange={updateField("last_name")}
                        type="text"
                        value={form.last_name}
                        maxLength={80}
                        required
                      />
                    </label>
                  </>
                ) : null}

                <label className="auth-form__field">
                  <span>Email</span>
                  <input
                    autoComplete="email"
                    name="email"
                    onChange={updateField("email")}
                    required
                    type="email"
                    value={form.email}
                  />
                </label>

                {!isForgot ? (
                  <label className="auth-form__field">
                    <span>Password</span>
                    <input
                      autoComplete={
                        isSignUp ? "new-password" : "current-password"
                      }
                      minLength={6}
                      name="password"
                      onChange={updateField("password")}
                      required
                      type="password"
                      value={form.password}
                    />
                  </label>
                ) : null}

                {isSignUp ? (
                  <label className="auth-form__field">
                    <span>Confirm password</span>
                    <input
                      autoComplete="new-password"
                      minLength={6}
                      name="password_confirmation"
                      onChange={updateField("password_confirmation")}
                      required
                      type="password"
                      value={form.password_confirmation}
                    />
                  </label>
                ) : null}

                {formError ? (
                  <p className="auth-form__error" role="alert">
                    {formError}
                  </p>
                ) : null}

                <button
                  className="auth-form__submit"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting
                    ? "Please wait..."
                    : isForgot
                      ? "Send reset link"
                      : isSignUp
                        ? "Create account"
                        : "Sign in"}
                </button>
              </form>
            )}

            {!isForgot && providers.length > 0 ? (
              <>
                <div className="auth-card__divider">
                  <span>OR</span>
                </div>
                <div className="auth-card__social-buttons">
                  {providers.map((provider) => (
                    <button
                      className={`auth-card__social-btn auth-card__social-btn--${provider}`}
                      disabled={isSubmitting || pendingProvider !== null}
                      key={provider}
                      onClick={() => handleSocial(provider)}
                      type="button"
                    >
                      {PROVIDER_ICONS[provider]}
                      <span>
                        {pendingProvider === provider
                          ? "Connecting..."
                          : `Continue with ${PROVIDER_LABELS[provider]}`}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {!isForgot && !isSignUp && (
              <p className="auth-card__switch">
                <button onClick={() => toggleMode("forgot")} type="button">
                  Forgot your password?
                </button>
              </p>
            )}

            <p className="auth-card__switch">
              {isForgot ? (
                <>
                  Remembered it?{" "}
                  <button onClick={() => toggleMode("signIn")} type="button">
                    Sign in
                  </button>
                </>
              ) : isSignUp ? (
                <>
                  Already have an account?{" "}
                  <button onClick={() => toggleMode("signIn")} type="button">
                    Sign in instead
                  </button>
                </>
              ) : (
                <>
                  New to Cellar Signal?{" "}
                  <button onClick={() => toggleMode("signUp")} type="button">
                    Create an account
                  </button>
                </>
              )}
            </p>
          </>
        )}

        <Link className="text-link" to="/wines">
          Back to wine list
        </Link>
      </section>
    </main>
  );
}

export default Login;
