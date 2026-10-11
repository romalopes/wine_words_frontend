import type {
  AccountApi,
  AccountUpdatePayload,
  BillingApi,
  ChangeConfirmResponse,
  ChangePreviewResponse,
  CheckoutSessionResponse,
  ConfirmCheckoutResponse,
  PasswordUpdatePayload,
  PortalSessionResponse,
  SubscriptionsApi,
  UserApi,
  UsersApi,
  VintagesApi,
} from "../types/api"
import type { Account } from "../types/account"
import type { User } from "../types/authentication"
import type { Subscription } from "../types/subscription"
import type { Vintage } from "../types/wine"
import type { ApiRequester } from "./apiClient"

export function createUserApi(request: ApiRequester): UserApi {
  return { findUser: (email) => request<User>(`/user/${email}`) }
}

export function createUsersApi(request: ApiRequester): UsersApi {
  return {
    roles: () => request("/roles", { auth: true }),
    search: (q, page = 1) => request(`/users/search?q=${encodeURIComponent(q)}&page=${page}`, { auth: true }),
    assignRoles: (userId, roleIds) => request(`/users/${userId}/assign_roles`, { method: "PATCH", auth: true, body: { role_ids: roleIds } }),
    assignSubscription: (userId, subscriptionId) => request(`/users/${userId}/assign_subscription`, { method: "PATCH", auth: true, body: { subscription_id: subscriptionId } }),
  }
}

export function createSubscriptionsApi(request: ApiRequester): SubscriptionsApi {
  return {
    list: ({ auth = false } = {}) => request<Subscription[]>("/subscriptions", { auth }),
    show: (id) => request<Subscription>(`/subscriptions/${id}`),
    create: (data) => request<Subscription>("/subscriptions", { method: "POST", auth: true, body: { subscription: data as unknown as Record<string, never> } }),
    update: (id, data) => request<Subscription>(`/subscriptions/${id}`, { method: "PATCH", auth: true, body: { subscription: data as unknown as Record<string, never> } }),
    destroy: (id) => request(`/subscriptions/${id}`, { method: "DELETE", auth: true }),
  }
}

export function createAccountApi(request: ApiRequester): AccountApi {
  return {
    show: () => request<Account>("/account", { auth: true }),
    update: (data: AccountUpdatePayload) => request<Account>("/account", { method: "PATCH", auth: true, body: data as unknown as Record<string, never> }),
    changePassword: (data: PasswordUpdatePayload) => request("/account/password", { method: "PATCH", auth: true, body: data as unknown as Record<string, never> }),
    updateAnalyticsOptOut: (optOut: boolean) =>
      request<{ analytics_opt_out: boolean }>("/account/analytics_opt_out", {
        method: "PATCH",
        auth: true,
        body: { analytics_opt_out: optOut },
      }),
  }
}

export function createBillingApi(request: ApiRequester): BillingApi {
  return {
    checkout: (subscriptionId) => request<CheckoutSessionResponse>("/billing/checkout", { method: "POST", auth: true, body: { subscription_id: subscriptionId } }),
    confirm: (sessionId) => request<ConfirmCheckoutResponse>("/billing/confirm", { method: "POST", auth: true, body: { session_id: sessionId } }),
    portal: () => request<PortalSessionResponse>("/billing/portal", { method: "POST", auth: true }),
    changePreview: (subscriptionId) => request<ChangePreviewResponse>("/billing/change/preview", { method: "POST", auth: true, body: { subscription_id: subscriptionId } }),
    changeConfirm: (subscriptionId, idempotencyKey) => request<ChangeConfirmResponse>("/billing/change/confirm", { method: "POST", auth: true, body: { subscription_id: subscriptionId, idempotency_key: idempotencyKey } }),
  }
}

export function createVintagesApi(request: ApiRequester): VintagesApi {
  return {
    create: (wineSlug, vintageData) => request<Vintage>(`/wines/${wineSlug}/vintages`, { method: "POST", auth: true, body: { vintage: vintageData as unknown as Record<string, never> } }),
  }
}
