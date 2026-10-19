/**
 * Social sign-in providers supported by the Rails API. The identity claim is
 * always minted provider-side and re-verified by the backend — see
 * `src/services/socialProviders.ts`.
 */
export type SocialProvider = "google" | "apple" | "microsoft" | "facebook"

/**
 * A provider-issued credential plus, for Apple only, the raw nonce the
 * frontend generated. This is posted to the API, which verifies it.
 */
export interface SocialCredential {
  credential: string
  nonce?: string
}

// --- Provider SDK shapes ---------------------------------------------------
// Only the members this app actually calls are described. Each SDK is loaded
// on demand from its own CDN and installs a global; these interfaces describe
// that global's surface, not the SDK's full API.

/** A One Tap / button callback payload. Only `credential` is trusted. */
export interface GoogleCredentialResponse {
  credential?: string | null
}

/** The prompt-moment notification GSI hands to the `prompt` listener. */
export interface GooglePromptMoment {
  isNotDisplayed?: () => boolean
  getNotDisplayedReason?: () => string | null | undefined
  isSkippedMoment?: () => boolean
  isDismissedMoment?: () => boolean
}

/** GSI `initialize` options. */
export interface GoogleInitializeConfig {
  client_id: string
  callback: (response: GoogleCredentialResponse) => void
  cancel_on_tap_outside?: boolean
}

export interface GoogleAccountsId {
  initialize: (config: GoogleInitializeConfig) => void
  renderButton: (parent: HTMLElement, options: {
    type: "standard"
    theme: "outline"
    size: "large"
    text: "continue_with"
  }) => void
  prompt: (listener: (notification: GooglePromptMoment) => void) => void
}

export interface GoogleSdk {
  accounts: { id: GoogleAccountsId }
}

/** Apple `auth.init` options. `nonce` is the SHA-256 hash of the raw nonce. */
export interface AppleInitConfig {
  clientId: string
  scope: string
  redirectURI: string
  usePopup: boolean
  nonce: string
}

/** The shape of the payload Apple resolves `signIn()` with. */
export interface AppleSignInResponse {
  authorization?: { id_token?: string | null } | null
  error?: string
  error_message?: string
}

export interface AppleSdk {
  auth: {
    init: (config: AppleInitConfig) => void
    signIn: () => Promise<AppleSignInResponse>
  }
}

/** MSAL popup result — `idToken` is the credential sent to the API. */
export interface MsalLoginResult {
  idToken?: string | null
  errorCode?: string
}

export interface MsalInstance {
  loginPopup: (request: {
    scopes: string[]
    prompt: string
  }) => Promise<MsalLoginResult>
  initialize?: () => Promise<void>
}

export interface MsalSdk {
  PublicClientApplication: new (config: {
    auth: { clientId: string; authority: string; redirectUri: string }
    cache: { cacheLocation: string }
  }) => MsalInstance
}

/** Facebook yields a short-lived access token, not a signed JWT. */
export interface FacebookLoginResponse {
  authResponse?: { accessToken?: string | null } | null
}

export interface FacebookSdk {
  init: (config: {
    appId: string
    cookie: boolean
    xfbml: boolean
    version: string
  }) => void
  login: (
    callback: (response: FacebookLoginResponse) => void,
    options: { scope: string; return_scopes: boolean },
  ) => void
}
