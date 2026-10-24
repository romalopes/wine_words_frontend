import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import PageHero from "./PageHero";
import { accountApi, countriesApi, identitiesApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import {
  ProviderCancelledError,
  availableProviders,
  providerLabel,
  signInWith,
} from "../services/socialProviders";
import type { SocialProvider } from "../types/socialAuth";
import type { PasswordChange } from "../types/account";
import type { Identity } from "../types/authentication";
import type { CountryListItem } from "../types/reference";
import type { ProducerSummary } from "../types/producer";
import { producerMembershipLabel } from "../constants/roles";
import { useAnalyticsOptOut } from "../hooks/useAnalyticsOptOut";

/** The editable profile form. Every field is a string so the inputs stay controlled. */
interface AccountForm {
  first_name: string;
  last_name: string;
  phone: string;
  date_of_birth: string;
  address: {
    street_address: string;
    city: string;
    state: string;
    postal_code: string;
    country_id: string;
  };
}

const emptyAccount: AccountForm = {
  first_name: "",
  last_name: "",
  phone: "",
  date_of_birth: "",
  address: {
    street_address: "",
    city: "",
    state: "",
    postal_code: "",
    country_id: "",
  },
};

/** Coerce a nullable API field to a string the controlled input can hold. */
function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

interface FieldProps {
  label: string;
  children: ReactNode;
  /** Stretches the field across both columns of the profile grid. */
  wide?: boolean;
}

function Field({ label, children, wide }: FieldProps) {
  return (
    <label className={`auth-form__field${wide ? " account-fields--wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

/** The API's `errors` hash: field name => message or messages. */
type FieldErrors = Record<string, string | string[] | null | undefined>;

/** Pull a readable message off an unknown rejection, flattening Rails' errors hash. */
function parseApiError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : fallback;
  try {
    const parsed: unknown = JSON.parse(message);
    if (parsed && typeof parsed === "object" && "errors" in parsed) {
      return (
        flattenErrors((parsed as { errors: FieldErrors }).errors) || message
      );
    }
  } catch {
    /* err.message is not JSON — use as-is */
  }
  return message;
}

// Collects every message from the API's errors object (hash of
// field => [messages]) into one readable line.
function flattenErrors(errors: FieldErrors | null | undefined): string {
  if (!errors) return "";
  return Object.entries(errors)
    .map(([field, messages]) => {
      const list = Array.isArray(messages) ? messages : [messages];
      return `${field.replace(/_/g, " ")} ${list.filter(Boolean).join(", ")}`;
    })
    .join(" · ");
}

export default function AccountSettings() {
  const { user, refreshSession } = useAuth();
  const { optedOut, setOptOut, saving: savingOptOut, error: optOutError } =
    useAnalyticsOptOut();
  const [form, setForm] = useState<AccountForm>(emptyAccount);
  const [countries, setCountries] = useState<CountryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwords, setPasswords] = useState<PasswordChange>({
    current_password: "",
    password: "",
    password_confirmation: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // Connected sign-in methods (Google / Apple / Microsoft / Facebook).
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [passwordAuthentication, setPasswordAuthentication] = useState(true);
  const [identitiesLoading, setIdentitiesLoading] = useState(true);
  const [identitiesNotice, setIdentitiesNotice] = useState<string | null>(null);
  const [identitiesError, setIdentitiesError] = useState<string | null>(null);
  const [connectingProvider, setConnectingProvider] =
    useState<SocialProvider | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);

  // My linked producers
  const [myProducers, setMyProducers] = useState<ProducerSummary[]>([]);
  const [myProducersLoading, setMyProducersLoading] = useState(true);
  const [myProducersError, setMyProducersError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMyProducersLoading(true);
    setMyProducersError(null);
    Promise.all([
      accountApi.show(),
      countriesApi.list().catch(() => []),
      accountApi.myProducers().catch(() => []),
    ])
      .then(([account, countryList, producers]) => {
        if (cancelled) return;
        setForm({
          first_name: str(account.first_name),
          last_name: str(account.last_name),
          phone: str(account.phone),
          date_of_birth: str(account.date_of_birth),
          address: {
            street_address: str(account.address?.street_address),
            city: str(account.address?.city),
            state: str(account.address?.state),
            postal_code: str(account.address?.postal_code),
            country_id: str(account.address?.country_id),
          },
        });
        setCountries(Array.isArray(countryList) ? countryList : []);
        setMyProducers(Array.isArray(producers) ? producers : []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setProfileError(
            err instanceof Error ? err.message : "Failed to load account.",
          );
          setMyProducersError(
            err instanceof Error ? err.message : "Failed to load producers.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setMyProducersLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadIdentities = useCallback(async () => {
    setIdentitiesLoading(true);
    setIdentitiesError(null);
    try {
      const data = await identitiesApi.list();
      setIdentities(Array.isArray(data?.identities) ? data.identities : []);
      setPasswordAuthentication(data?.password_authentication !== false);
    } catch (err) {
      setIdentitiesError(parseApiError(err, "Failed to load sign-in methods."));
    } finally {
      setIdentitiesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIdentities();
  }, [loadIdentities]);

  type ProfileField = Exclude<keyof AccountForm, "address">;
  type AddressField = keyof AccountForm["address"];

  function setField(key: ProfileField, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setAddressField(key: AddressField, value: string) {
    setForm((prev) => ({
      ...prev,
      address: { ...prev.address, [key]: value },
    }));
  }

  async function handleSaveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileNotice(null);
    setProfileError(null);
    try {
      await accountApi.update({
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        phone: form.phone || null,
        date_of_birth: form.date_of_birth || null,
        address: {
          street_address: form.address.street_address || null,
          city: form.address.city || null,
          state: form.address.state || null,
          postal_code: form.address.postal_code || null,
          country_id: form.address.country_id || null,
        },
      });
      setProfileNotice("Account updated.");
      refreshSession(); // the header shows the account name — keep it in sync
    } catch (err) {
      setProfileError(parseApiError(err, "Could not save your account."));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordNotice(null);
    setPasswordError(null);
    try {
      await accountApi.changePassword(passwords);
      setPasswordNotice("Password updated.");
      setPasswords({
        current_password: "",
        password: "",
        password_confirmation: "",
      });
    } catch (err) {
      setPasswordError(parseApiError(err, "Could not change your password."));
    } finally {
      setSavingPassword(false);
    }
  }

  // Runs the provider popup and hands the resulting credential to the API.
  // The frontend never asserts who the user is — the backend verifies it.
  async function handleConnect(provider: SocialProvider) {
    setConnectingProvider(provider);
    setIdentitiesNotice(null);
    setIdentitiesError(null);
    try {
      const { credential, nonce } = await signInWith(provider);
      await identitiesApi.connect(provider, { credential, nonce });
      setIdentitiesNotice(`${providerLabel(provider)} connected.`);
      await loadIdentities();
    } catch (err) {
      // Dismissing the provider popup is not an error worth showing.
      if (err instanceof ProviderCancelledError) return;
      setIdentitiesError(
        parseApiError(err, `Could not connect ${providerLabel(provider)}.`),
      );
    } finally {
      setConnectingProvider(null);
    }
  }

  async function handleDisconnect(identity: Identity) {
    setDisconnectingId(identity.id);
    setIdentitiesNotice(null);
    setIdentitiesError(null);
    try {
      await identitiesApi.disconnect(identity.id);
      setIdentitiesNotice(`${providerLabel(identity.provider)} disconnected.`);
      await loadIdentities();
    } catch (err) {
      // The API refuses to remove the last remaining sign-in method.
      setIdentitiesError(
        parseApiError(err, "Could not disconnect that sign-in method."),
      );
    } finally {
      setDisconnectingId(null);
    }
  }

  // Providers this deployment exposes that are not connected yet.
  const connectedProviders = identities.map((identity) => identity.provider);
  const connectable = availableProviders().filter(
    (provider) => !connectedProviders.includes(provider),
  );

  return (
    <main className="wine-app">
      <PageHero
        kicker="Account"
        title="Account settings"
        description="Manage your personal information, address and password."
      />

      {loading && <p className="wine-management__loading">Loading account…</p>}

      {!loading && (
        <div className="account-grid">
          <section className="account-card" aria-labelledby="membership-title">
            <div className="auth-form">
              <h2 className="account-card__title" id="membership-title">
                Membership
              </h2>
              <p className="account-card__lede">
                Current plan:{" "}
                <strong>{user?.subscription?.name ?? "Free"}</strong>
                {user?.subscription_status && (
                  <span> · {user.subscription_status}</span>
                )}
              </p>
              <p className="account-card__lede">
                <Link className="text-link" to="/subscribe">
                  Manage your plan
                </Link>
              </p>
            </div>
          </section>

          <section className="account-card">
            <form className="auth-form" onSubmit={handleSaveProfile}>
              <h2 className="account-card__title">Profile</h2>
              {profileNotice && (
                <p className="review-form__success">{profileNotice}</p>
              )}
              {profileError && (
                <p className="review-form__error">{profileError}</p>
              )}

              <h3 className="account-section-title account-section-title--first">
                Personal information
              </h3>
              <div className="account-fields">
                <Field label="First name">
                  <input
                    type="text"
                    autoComplete="given-name"
                    required
                    value={form.first_name}
                    onChange={(e) => setField("first_name", e.target.value)}
                    maxLength={80}
                  />
                </Field>
                <Field label="Last name">
                  <input
                    type="text"
                    autoComplete="family-name"
                    required
                    value={form.last_name}
                    onChange={(e) => setField("last_name", e.target.value)}
                    maxLength={80}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    maxLength={40}
                  />
                </Field>
                <Field label="Date of birth">
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => setField("date_of_birth", e.target.value)}
                  />
                </Field>
              </div>

              <h3 className="account-section-title">Address</h3>
              <div className="account-fields">
                <Field label="Street" wide>
                  <input
                    type="text"
                    value={form.address.street_address}
                    onChange={(e) =>
                      setAddressField("street_address", e.target.value)
                    }
                    maxLength={200}
                  />
                </Field>
                <Field label="City">
                  <input
                    type="text"
                    value={form.address.city}
                    onChange={(e) => setAddressField("city", e.target.value)}
                  />
                </Field>
                <Field label="State">
                  <input
                    type="text"
                    value={form.address.state}
                    onChange={(e) => setAddressField("state", e.target.value)}
                  />
                </Field>
                <Field label="Postal code">
                  <input
                    type="text"
                    value={form.address.postal_code}
                    onChange={(e) =>
                      setAddressField("postal_code", e.target.value)
                    }
                    maxLength={20}
                  />
                </Field>
                <Field label="Country">
                  <select
                    value={form.address.country_id}
                    onChange={(e) =>
                      setAddressField("country_id", e.target.value)
                    }
                  >
                    <option value="">— Select country —</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <button
                type="submit"
                className="auth-form__submit"
                disabled={savingProfile}
              >
                {savingProfile ? "Saving…" : "Save profile"}
              </button>
            </form>
          </section>

          <section className="account-card">
            <form
              className="auth-form account-security-form"
              onSubmit={handleChangePassword}
            >
              <h2 className="account-card__title">Security</h2>
              <p className="account-card__lede">
                Choose a strong password you don't use anywhere else.
              </p>
              {passwordNotice && (
                <p className="review-form__success">{passwordNotice}</p>
              )}
              {passwordError && (
                <p className="review-form__error">{passwordError}</p>
              )}
              <Field label="Current password">
                <input
                  type="password"
                  value={passwords.current_password}
                  onChange={(e) =>
                    setPasswords((p) => ({
                      ...p,
                      current_password: e.target.value,
                    }))
                  }
                  required
                  autoComplete="current-password"
                />
              </Field>
              <Field label="New password">
                <input
                  type="password"
                  value={passwords.password}
                  onChange={(e) =>
                    setPasswords((p) => ({ ...p, password: e.target.value }))
                  }
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Confirm new password">
                <input
                  type="password"
                  value={passwords.password_confirmation}
                  onChange={(e) =>
                    setPasswords((p) => ({
                      ...p,
                      password_confirmation: e.target.value,
                    }))
                  }
                  required
                  autoComplete="new-password"
                />
              </Field>
              <button
                type="submit"
                className="auth-form__submit"
                disabled={savingPassword}
              >
                {savingPassword ? "Updating…" : "Change password"}
              </button>
            </form>
          </section>

          <section className="account-card">
            <div className="auth-form account-security-form">
              <h2 className="account-card__title">Privacy</h2>
              <p className="account-card__lede">
                Control whether your content views are counted in editorial
                analytics. Opting out stops future tracking immediately.
              </p>
              {optOutError && (
                <p className="review-form__error">{optOutError}</p>
              )}
              <label className="account-identity">
                <input
                  type="checkbox"
                  checked={!optedOut}
                  disabled={savingOptOut}
                  onChange={(e) => setOptOut(!e.target.checked)}
                />
                <span className="account-identity__label">
                  Count my views in content analytics
                </span>
              </label>
              {savingOptOut && (
                <p className="wine-management__loading">Saving…</p>
              )}
            </div>
          </section>

          <section className="account-card">
            <div className="auth-form account-security-form">
              <h2 className="account-card__title">Sign-in methods</h2>
              <p className="account-card__lede">
                Use a social account as well as your password. Connecting a
                provider never changes your plan or your permissions.
              </p>

              {identitiesNotice && (
                <p className="review-form__success">{identitiesNotice}</p>
              )}
              {identitiesError && (
                <p className="review-form__error">{identitiesError}</p>
              )}

              {identitiesLoading ? (
                <p className="wine-management__loading">
                  Loading sign-in methods…
                </p>
              ) : (
                <>
                  <ul className="account-identities">
                    {passwordAuthentication && (
                      <li className="account-identity">
                        <span className="account-identity__label">
                          Email &amp; password
                        </span>
                        <span className="account-identity__meta">
                          Connected
                        </span>
                      </li>
                    )}
                    {identities.map((identity) => (
                      <li className="account-identity" key={identity.id}>
                        <span className="account-identity__label">
                          {providerLabel(identity.provider)}
                        </span>
                        <span className="account-identity__meta">
                          {identity.email || "Connected"}
                        </span>
                        <button
                          type="button"
                          className="account-identity__action"
                          onClick={() => handleDisconnect(identity)}
                          disabled={disconnectingId === identity.id}
                        >
                          {disconnectingId === identity.id
                            ? "Disconnecting…"
                            : "Disconnect"}
                        </button>
                      </li>
                    ))}
                  </ul>

                  {connectable.length > 0 && (
                    <>
                      <h3 className="account-section-title">Connect another</h3>
                      <div className="auth-card__social-buttons">
                        {connectable.map((provider) => (
                          <button
                            key={provider}
                            type="button"
                            className={`auth-card__social-btn auth-card__social-btn--${provider}`}
                            onClick={() => handleConnect(provider)}
                            disabled={connectingProvider !== null}
                          >
                            {connectingProvider === provider
                              ? `Connecting ${providerLabel(provider)}…`
                              : `Connect ${providerLabel(provider)}`}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </section>

          {/* My Producers section */}
          <section className="account-card">
            <div className="auth-form">
              <h2 className="account-card__title">My Producers</h2>
              {myProducersLoading ? (
                <p className="wine-management__loading">Loading producers...</p>
              ) : myProducersError ? (
                <p className="review-form__error">{myProducersError}</p>
              ) : myProducers.length === 0 ? (
                <p className="account-card__lede">
                  You are not linked to any producers yet. Contact an administrator to link
                  your account to a producer.
                </p>
              ) : (
                <ul className="producer-links">
                  {myProducers.map((producer) => (
                    <li key={producer.id} className="producer-link-item">
                      <Link to={`/producers/${producer.slug}`} className="producer-link">
                        <strong>{producer.name}</strong>
                        <span className="producer-link__meta">
                          {producer.country || "No country"}
                          {" · "}
                          <span
                            className={`membership-badge membership-badge--${producer.membership_type}`}
                          >
                            {producerMembershipLabel(producer.membership_type)}
                          </span>
                        </span>
                      </Link>
                      {/* Contributors may view the association but not edit it
                          (issue #191); `can_edit` is derived by the API. */}
                      {producer.can_edit && (
                        <Link
                          to={`/producers/${producer.slug}/edit`}
                          className="btn btn-secondary btn-sm"
                        >
                          Edit
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
