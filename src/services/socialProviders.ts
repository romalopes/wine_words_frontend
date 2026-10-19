// Social sign-in provider SDKs (Google, Apple, Microsoft, Facebook).
//
// Each provider's *official* JavaScript SDK is loaded on demand and used to
// obtain a credential (an ID token, or a Facebook access token). That credential
// is posted to the Rails API, which verifies it with the provider and resolves
// the application User.
//
// Two rules this module exists to enforce:
//
//   1. The browser never sends identity *claims* (email, user id, name) to the
//      backend as proof of anything — only the provider-issued credential.
//   2. Only public identifiers live here. Every secret (Google client secret,
//      Apple private key, Microsoft client secret, Facebook app secret) stays
//      in the API's environment and is never present in the React bundle.
//
// The scripts come from the providers' own CDNs; nothing is bundled or vendored.

import type {
  AppleSdk,
  AppleSignInResponse,
  FacebookLoginResponse,
  FacebookSdk,
  GoogleSdk,
  MsalInstance,
  MsalSdk,
  SocialCredential,
  SocialProvider,
} from "../types/socialAuth"

/**
 * Render an unknown thrown value as a searchable string.
 *
 * The Apple SDK rejects with a plain object (`{ error, error_message }`) rather
 * than an `Error`, so the discrimination has to survive a non-Error throw.
 * `utils/errors.ts` covers the same need for HTTP failures; this is the
 * provider-SDK-local equivalent and stays private to this module.
 */
function describeError(err: unknown): string {
  if (typeof err === "string") return err
  if (err instanceof Error) return err.message
  if (typeof err === "object" && err !== null) {
    const record = err as Record<string, unknown>
    return [record.error, record.error_message, record.message]
      .filter((part): part is string => typeof part === "string")
      .join(" ")
  }
  return String(err)
}

const GOOGLE_SDK_URL = "https://accounts.google.com/gsi/client";
const APPLE_SDK_URL =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
const MICROSOFT_SDK_URL =
  "https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js";
const FACEBOOK_SDK_URL = "https://connect.facebook.net/en_US/sdk.js";

// Provider is not configured for this deployment (no client id in the Vite env).
export class ProviderUnavailableError extends Error {
  readonly provider: string

  constructor(provider: string) {
    super(`${provider} sign-in is not available right now.`);
    this.name = "ProviderUnavailableError";
    this.provider = provider;
  }
}

// The provider itself refused to run — almost always a dashboard
// configuration problem (origin/client ID), not something the person using the
// app can fix. Surfaced to the UI, unlike a cancelled popup.
export class ProviderConfigurationError extends Error {
  readonly provider: string
  readonly detail: string

  constructor(provider: string, detail: string) {
    super(`${provider} sign-in isn't available on this address. ${detail}`);
    this.name = "ProviderConfigurationError";
    this.provider = provider;
    this.detail = detail;
  }
}

// The person closed the provider popup without finishing, or the provider
// declined the request. Not an error worth showing as a failure.
export class ProviderCancelledError extends Error {
  readonly provider: string

  constructor(provider: string) {
    super(`${provider} sign-in was cancelled.`);
    this.name = "ProviderCancelledError";
    this.provider = provider;
  }
}

/** The public, frontend-safe config each provider's SDK initialisation needs. */
interface PublicProviderConfig {
  google: { clientId: string | undefined }
  apple: { clientId: string | undefined; redirectURI: string }
  microsoft: { clientId: string | undefined; tenant: string }
  facebook: { appId: string | undefined; graphVersion: string }
}

/**
 * One factory per provider.
 *
 * Modelled as an interface (not `Record<SocialProvider, …>`) on purpose: a
 * Record would widen every factory to the *union* of all four return types, so
 * `publicConfig.apple().redirectURI` would stop type-checking. Declaring each
 * member separately keeps `publicConfig.apple()` inferred as the Apple config.
 */
interface PublicProviderConfigFactories {
  google: () => PublicProviderConfig["google"]
  apple: () => PublicProviderConfig["apple"]
  microsoft: () => PublicProviderConfig["microsoft"]
  facebook: () => PublicProviderConfig["facebook"]
}

// Only public, frontend-safe identifiers. Every value here is compiled into the
// Vite bundle, so nothing secret may ever be added.
const publicConfig: PublicProviderConfigFactories = {
  google: () => ({
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  }),
  apple: () => ({
    clientId: import.meta.env.VITE_APPLE_CLIENT_ID,
    redirectURI:
      import.meta.env.VITE_APPLE_REDIRECT_URI || window.location.origin,
  }),
  microsoft: () => ({
    clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID,
    // Must match the API's MICROSOFT_TENANT_ID: "common" supports personal and
    // organisational accounts, see docs/social_authentication.md.
    tenant: import.meta.env.VITE_MICROSOFT_TENANT_ID || "common",
  }),
  facebook: () => ({
    appId: import.meta.env.VITE_FACEBOOK_APP_ID,
    graphVersion: import.meta.env.VITE_FACEBOOK_GRAPH_VERSION || "v21.0",
  }),
};

// Human labels for the sign-in buttons (also used by Account settings).
export const PROVIDER_LABELS: Record<SocialProvider, string> = {
  google: "Google",
  apple: "Apple",
  microsoft: "Microsoft",
  facebook: "Facebook",
};

/** True when this deployment's env carries the provider's client id / app id. */
function isPresent(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim().length > 0
}

/**
 * Human label for a provider key.
 *
 * Accepts a plain `string` because `Identity.provider` is whatever the database
 * holds — a row written by a future provider must still render, so the raw key
 * is humanized and returned as the fallback rather than crashing on an
 * undefined lookup.
 */
export function providerLabel(provider: string): string {
  if (isSocialProvider(provider)) return PROVIDER_LABELS[provider]
  return provider
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function isSocialProvider(value: string): value is SocialProvider {
  return Object.prototype.hasOwnProperty.call(PROVIDER_LABELS, value)
}

/**
 * The identifier that decides whether a provider is usable: Google, Apple and
 * Microsoft all need a client id, Facebook needs an app id.
 */
function configuredIdentifier(provider: SocialProvider): string | undefined {
  switch (provider) {
    case "google":
      return publicConfig.google().clientId;
    case "apple":
      return publicConfig.apple().clientId;
    case "microsoft":
      return publicConfig.microsoft().clientId;
    case "facebook":
      return publicConfig.facebook().appId;
  }
}

// Providers this deployment actually exposes a button for.
export function availableProviders(): SocialProvider[] {
  return (Object.keys(publicConfig) as SocialProvider[]).filter((provider) =>
    isPresent(configuredIdentifier(provider)),
  );
}

export function isConfigured(provider: SocialProvider): boolean {
  return availableProviders().includes(provider);
}

function requireClientId(provider: string, value: string | undefined): string {
  if (!value?.trim()) throw new ProviderUnavailableError(provider);
  return value.trim();
}

// ---------------------------------------------------------------------------
// SDK loading
// ---------------------------------------------------------------------------

// Injects a provider's SDK script once and resolves when it has loaded.
const scriptPromises = new Map<string, Promise<void>>();

function loadScript(url: string): Promise<void> {
  const cached = scriptPromises.get(url);
  if (cached) return cached;

  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${url}"]`,
    );
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }

    const script = existing ?? document.createElement("script");
    script.src = url;
    script.async = true;
    script.defer = true;

    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () => {
      scriptPromises.delete(url);
      script.remove();
      reject(new ProviderUnavailableError("This"));
    });

    if (!existing) document.head.appendChild(script);
  });

  scriptPromises.set(url, promise);
  return promise;
}

/** Poll options for `waitForGlobal`. */
interface WaitForGlobalOptions {
  attempts?: number
  interval?: number
}

/**
 * Waits for a global the SDK installs (e.g. `google`, `AppleID`, `msal`, `FB`).
 * Typed as `unknown` because the global's shape depends on which SDK the caller
 * asked for — each sign-in function narrows it to its own interface.
 */
function waitForGlobal(
  name: string,
  { attempts = 50, interval = 100 }: WaitForGlobalOptions = {},
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const tick = () => {
      if (name in window) {
        resolve((window as unknown as Record<string, unknown>)[name]);
        return;
      }
      tries += 1;
      if (tries >= attempts) {
        reject(new ProviderUnavailableError(name));
        return;
      }
      window.setTimeout(tick, interval);
    };
    tick();
  });
}

// ---------------------------------------------------------------------------
// Nonce helpers (Apple requires the raw nonce to be sent alongside the token)
// ---------------------------------------------------------------------------

function newNonce(): string {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

// ---------------------------------------------------------------------------
// Google — Google Identity Services (One Tap / button credential)
// ---------------------------------------------------------------------------
//
// Use Google's official button for explicit sign-in. One Tap can be suppressed
// by browser settings or cooldowns and is not a reliable click-to-sign-in flow.
// A native dialog also lets cancellation settle the promise without depending
// on prompt-moment notifications that FedCM no longer always delivers.
export async function signInWithGoogle(): Promise<SocialCredential> {
  const clientId = requireClientId("Google", publicConfig.google().clientId);
  await loadScript(GOOGLE_SDK_URL);
  const google = (await waitForGlobal("google")) as GoogleSdk;

  return new Promise<SocialCredential>((resolve, reject) => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = document.createElement("dialog");
    dialog.className = "social-sign-in-dialog";
    dialog.setAttribute("aria-label", "Sign in with Google");
    const heading = document.createElement("h2");
    heading.textContent = "Sign in with Google";
    const buttonHost = document.createElement("div");
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    dialog.append(heading, buttonHost, cancel);
    let settled = false;
    const finish = (credential?: string | null, error?: unknown) => {
      if (settled) return;
      settled = true;
      dialog.remove();
      previousFocus?.focus();
      if (credential) resolve({ credential });
      else reject(error ?? new ProviderCancelledError("Google"));
    };
    cancel.addEventListener("click", () => finish());
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish();
    });
    dialog.addEventListener("close", () => finish());
    try {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => finish(response?.credential),
      });
      document.body.appendChild(dialog);
      dialog.showModal();
      google.accounts.id.renderButton(buttonHost, {
        type: "standard", theme: "outline", size: "large", text: "continue_with",
      });
    } catch (error) {
      finish(undefined, error);
    }
  });
}

// ---------------------------------------------------------------------------
// Apple — Sign in with Apple JS
// ---------------------------------------------------------------------------
//
// Apple returns an identity token containing a `nonce` claim. We generate a raw
// nonce, send Apple its SHA-256 hash, and hand the raw value to the API with the
// token. The API re-hashes the raw nonce and compares it with the claim, so a
// captured identity token cannot be replayed on its own.
//
// Apple may also return a private relay address (…@privaterelay.appleid.com).
// The API treats Apple's `sub` as the identity and never auto-links an existing
// account on a relay address, so "Hide My Email" users still get exactly one
// account.
export async function signInWithApple(): Promise<SocialCredential> {
  const config = publicConfig.apple();
  const clientId = requireClientId("Apple", config.clientId);

  await loadScript(APPLE_SDK_URL);
  const apple = (await waitForGlobal("AppleID")) as AppleSdk;

  const rawNonce = newNonce();
  const hashedNonce = await sha256Hex(rawNonce);

  apple.auth.init({
    clientId,
    scope: "name email",
    redirectURI: config.redirectURI,
    usePopup: true,
    nonce: hashedNonce,
  });

  let data: AppleSignInResponse;
  try {
    data = await apple.auth.signIn();
  } catch (err) {
    // Apple reports a user-dismissed popup as "popup_closed_by_user".
    if (describeError(err).includes("popup_closed")) {
      throw new ProviderCancelledError("Apple");
    }
    throw err;
  }

  const identityToken = data?.authorization?.id_token;
  if (!identityToken) throw new ProviderCancelledError("Apple");

  return { credential: identityToken, nonce: rawNonce };
}

// ---------------------------------------------------------------------------
// Microsoft — Microsoft identity platform (MSAL browser SDK)
// ---------------------------------------------------------------------------
//
// Wine Prediction supports BOTH personal Microsoft accounts and organisational
// (work/school) accounts, so the default tenant is "common" (see
// docs/social_authentication.md). The tenant configured here must match the
// API's MICROSOFT_TENANT_ID, because the API independently re-checks the
// token's issuer and `tid` claim against that policy.
//
// Only the default OpenID scopes (openid profile email) are requested — no
// Microsoft Graph permission is asked for, because authentication needs nothing
// more than the ID token.
let msalInstance: MsalInstance | null = null;
let msalClientId: string | null = null;

function microsoftAuthority(config: { tenant: string }): string {
  return `https://login.microsoftonline.com/${config.tenant}`;
}

async function microsoftClient(): Promise<MsalInstance> {
  const config = publicConfig.microsoft();
  const clientId = requireClientId("Microsoft", config.clientId);

  await loadScript(MICROSOFT_SDK_URL);
  const msal = (await waitForGlobal("msal")) as MsalSdk;
  if (!msal?.PublicClientApplication)
    throw new ProviderUnavailableError("Microsoft");

  if (!msalInstance || msalClientId !== clientId) {
    msalInstance = new msal.PublicClientApplication({
      auth: {
        clientId,
        authority: microsoftAuthority(config),
        // Back to the app origin: the popup closes and MSAL hands the result
        // back in-page; there is no server redirect to the Rails API.
        redirectUri: window.location.origin,
      },
      // sessionStorage keeps MSAL's own cache out of the way of the app's JWT,
      // which lives in localStorage.
      cache: { cacheLocation: "sessionStorage" },
    });
    msalClientId = clientId;
  }

  await msalInstance.initialize?.();
  return msalInstance;
}

export async function signInWithMicrosoft(): Promise<SocialCredential> {
  const instance = await microsoftClient();

  try {
    const result = await instance.loginPopup({
      scopes: ["openid", "profile", "email"],
      prompt: "select_account",
    });

    if (!result?.idToken) throw new ProviderCancelledError("Microsoft");
    return { credential: result.idToken };
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      (err as { errorCode?: unknown }).errorCode === "user_cancelled"
    ) {
      throw new ProviderCancelledError("Microsoft");
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Facebook — Facebook Login (Meta)
// ---------------------------------------------------------------------------
//
// The SDK yields a short-lived *access token*, not a signed JWT, so the API
// verifies it server-side by calling Facebook's Graph API (debug_token +
// /me) with the app secret. A UID or email echoed to the frontend is never
// accepted as proof.
//
// Only `public_profile` and `email` are requested — the minimum needed to
// establish identity. Instagram is not a separate provider.
let facebookInitialised = false;

async function facebookClient(): Promise<FacebookSdk> {
  const config = publicConfig.facebook();
  const appId = requireClientId("Facebook", config.appId);

  await loadScript(FACEBOOK_SDK_URL);
  const FB = (await waitForGlobal("FB")) as FacebookSdk;

  if (!facebookInitialised) {
    FB.init({
      appId,
      cookie: false,
      xfbml: false,
      version: config.graphVersion,
    });
    facebookInitialised = true;
  }

  return FB;
}

export async function signInWithFacebook(): Promise<SocialCredential> {
  const FB = await facebookClient();

  const response = await new Promise<FacebookLoginResponse>((resolve) => {
    FB.login(resolve, { scope: "public_profile,email", return_scopes: true });
  });

  const accessToken = response?.authResponse?.accessToken;
  // A dismissal leaves status "unknown" with no authResponse.
  if (!accessToken) throw new ProviderCancelledError("Facebook");

  return { credential: accessToken };
}

// ---------------------------------------------------------------------------
// Dispatcher used by the Login card
// ---------------------------------------------------------------------------

type SignInHandler = () => Promise<SocialCredential>;

const SIGN_IN_HANDLERS: Record<SocialProvider, SignInHandler> = {
  google: signInWithGoogle,
  apple: signInWithApple,
  microsoft: signInWithMicrosoft,
  facebook: signInWithFacebook,
};

// Runs the provider popup and returns { credential, nonce? } for the API.
export async function signInWith(
  provider: SocialProvider,
): Promise<SocialCredential> {
  const handler = SIGN_IN_HANDLERS[provider];
  if (!handler) throw new ProviderUnavailableError(provider);
  return handler();
}
