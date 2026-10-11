/**
 * The `{ id, name }` subscription stub Rails embeds in the user payload.
 * Mirrors `users_controller#me`.
 */
export interface SubscriptionStub {
  id: number
  name: string
}

/**
 * A plan change the user has scheduled but which has not taken effect yet
 * (`subscription_changes.most_recent_for`). Drives the "downgrade scheduled"
 * banner on the Membership screen.
 */
export interface SubscriptionChange {
  id: number
  change_type: string
  status: string
  effective_at: string | null
  to_subscription: (SubscriptionStub & { slug?: string | null }) | null
}

/**
 * `GET /users/me`. The field set is fixed by `users_controller#me` — the
 * subscription block, the billing capability flag and the pending plan change
 * are all explicitly rendered, so they are typed rather than left to the index
 * signature below.
 */
export interface User {
  id: number
  email: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  roles: string[]
  /** Opted out of content-view analytics (`users.analytics_opt_out`). */
  analytics_opt_out: boolean
  subscription: SubscriptionStub | null
  /** Stripe provider attached to the live subscription, if any. */
  billing_provider: string | null
  /** Whether Stripe is configured for this deployment at all. */
  can_manage_billing: boolean
  /** Live `user_subscriptions#status`, if the user has one. */
  subscription_status: string | null
  /** A downgrade/upgrade queued for a future date; absent when there is none. */
  subscription_change: SubscriptionChange | null
  /** `admin` is still accepted from older payloads and impersonation. */
  admin?: boolean
  [key: string]: unknown
}

export interface SignInPayload {
  email: string
  password: string
}

export interface SignUpPayload {
  email: string
  password: string
  password_confirmation: string
  first_name: string
  last_name: string
}

export interface ForgotPasswordPayload {
  email: string
}

export interface ResetPasswordPayload {
  reset_password_token: string
  password: string
  password_confirmation: string
}

export interface SocialSignInInput {
  credential: string
  /** Only Apple's flow produces one; see `SocialCredential` in socialAuth.ts. */
  nonce?: string | undefined
}

export interface AuthResponse {
  user: User
  token?: string
  [key: string]: unknown
}

/**
 * A connected sign-in method, as returned by
 * `Api::V1::UserIdentitiesController#identity_json`.
 */
export interface Identity {
  id: number
  /**
   * A provider key. The model only validates presence, so this is typed as a
   * plain string rather than the `SocialProvider` union — a row written by a
   * future provider must not become a compile error here. Use
   * `providerLabel()` to render it.
   */
  provider: string
  /** Server-rendered human name ("Google"), already humanized. */
  label?: string | null
  email?: string | null
  display_name?: string | null
  created_at?: string | null
  [key: string]: unknown
}

/**
 * The `email_verification` sub-object the API attaches to a sign-up response
 * (and to the 403 body of a blocked sign-in) when the account exists but has
 * not been verified. Its presence with `pending: true` means NO session was
 * issued — the frontend must show the "check your inbox" banner instead of
 * treating the sign-in as complete.
 */
export interface EmailVerification {
  email_verification_pending: boolean
  email_verification_expired?: boolean
  /** ISO timestamp after which the link stops working. */
  email_verification_deadline?: string | null
  [key: string]: unknown
}

/** The sign-up response, which may carry a pending verification instead of a session. */
export interface SignUpResponse extends AuthResponse {
  email_verification?: EmailVerification
}

/** Endpoints that answer with a human-readable message and nothing else. */
export interface MessageResponse {
  message?: string
  [key: string]: unknown
}
