import type { ApiRequester, RequestBody as ApiRequestBody } from "./apiClient"
import type {
  AuthApi,
  IdentitiesApi,
  IdentityListResponse,
  IdentityResponse,
  SocialProvider,
} from "../types/api"
import type {
  AuthResponse,
  ForgotPasswordPayload,
  MessageResponse,
  ResetPasswordPayload,
  SignInPayload,
  SignUpPayload,
  SignUpResponse,
  SocialSignInInput,
} from "../types/authentication"

// Type helper to satisfy exactOptionalPropertyTypes while passing dynamic bodies
const toBody = (obj: Record<string, unknown>): ApiRequestBody => obj as ApiRequestBody

export type { ApiRequester } from "./apiClient"

export function createAuthApi(request: ApiRequester): AuthApi {
  return {
    signIn(payload: SignInPayload): Promise<AuthResponse> {
      return request<AuthResponse>("/auth/sign_in", {
        method: "POST",
        body: toBody({ user: {
          email: payload.email,
          password: payload.password,
          turnstile_token: payload.turnstile_token,
        } }),
      })
    },

    signUp(payload: SignUpPayload): Promise<SignUpResponse> {
      return request<SignUpResponse>("/auth/sign_up", {
        method: "POST",
        body: toBody({ user: {
          email: payload.email,
          password: payload.password,
          password_confirmation: payload.password_confirmation,
          first_name: payload.first_name,
          last_name: payload.last_name,
          turnstile_token: payload.turnstile_token,
        } }),
      })
    },

    signOut(): Promise<unknown> {
      return request("/auth/sign_out", { method: "DELETE", auth: true })
    },

    forgotPassword(payload: ForgotPasswordPayload): Promise<MessageResponse> {
      return request<MessageResponse>("/auth/password", {
        method: "POST",
        body: toBody({ user: {
          email: payload.email,
          turnstile_token: payload.turnstile_token,
        } }),
      })
    },

    resetPassword(payload: ResetPasswordPayload): Promise<AuthResponse> {
      return request<AuthResponse>("/auth/password", {
        method: "PATCH",
        body: toBody({ user: {
          reset_password_token: payload.reset_password_token,
          password: payload.password,
          password_confirmation: payload.password_confirmation,
          turnstile_token: payload.turnstile_token,
        } }),
      })
    },

    me(): Promise<AuthResponse> {
      return request<AuthResponse>("/me", { auth: true })
    },

    socialSignIn(
      provider: SocialProvider,
      payload: SocialSignInInput = { credential: "" },
    ): Promise<AuthResponse> {
      if (payload.nonce) {
        return request<AuthResponse>(`/auth/${provider}`, {
          method: "POST",
          body: { credential: payload.credential, nonce: payload.nonce },
        })
      }

      return request<AuthResponse>(`/auth/${provider}`, {
        method: "POST",
        body: { credential: payload.credential },
      })
    },
  }
}

export function createIdentitiesApi(request: ApiRequester): IdentitiesApi {
  return {
    list(): Promise<IdentityListResponse> {
      return request<IdentityListResponse>("/auth/identities", { auth: true })
    },

    connect(
      provider: SocialProvider,
      payload: SocialSignInInput = { credential: "" },
    ): Promise<IdentityResponse> {
      if (payload.nonce) {
        return request<IdentityResponse>(`/auth/identities/${provider}`, {
          method: "POST",
          auth: true,
          body: { credential: payload.credential, nonce: payload.nonce },
        })
      }

      return request<IdentityResponse>(`/auth/identities/${provider}`, {
        method: "POST",
        auth: true,
        body: { credential: payload.credential },
      })
    },

    disconnect(id: number): Promise<unknown> {
      return request(`/auth/identities/${id}`, {
        method: "DELETE",
        auth: true,
      })
    },
  }
}
