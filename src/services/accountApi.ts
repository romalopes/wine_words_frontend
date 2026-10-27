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
import type { ProducerSummary } from "../types/producer"
import type { Subscription } from "../types/subscription"
import type {
  AccountInvitation,
  CreateManagedUserPayload,
  InvitationValidationResponse,
  UserDetail,
  ProducerMembership,
} from "../types/user"
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
    show: (userId) => request<UserDetail>(`/users/${userId}`, { auth: true }),
    create: (payload: CreateManagedUserPayload) => request<UserDetail>("/users", {
      method: "POST",
      auth: true,
      body: { user: payload } as unknown as Record<string, never>,
    }),
    updateInvitationEmail: (userId, email) => request<UserDetail>(`/users/${userId}/invitation_email`, {
      method: "PATCH", auth: true, body: { user: { email } },
    }),
    updateAccount: (userId, data) => request<Account>(`/users/${userId}/account`, { method: "PATCH", auth: true, body: data as unknown as Record<string, never> }),
    softDelete: (userId) => request(`/users/${userId}/soft_delete`, { method: "DELETE", auth: true }),
    hardDelete: (userId) => request(`/users/${userId}/hard_delete`, { method: "DELETE", auth: true }),
    reactivate: (userId) => request(`/users/${userId}/reactivate`, { method: "POST", auth: true }),
    invitations: {
      list: (userId) => request<AccountInvitation[]>(`/users/${userId}/invitations`, { auth: true }),
      send: (userId) => request<AccountInvitation>(`/users/${userId}/invitations`, { method: "POST", auth: true }),
      resend: (userId) => request<AccountInvitation>(`/users/${userId}/invitations/resend`, { method: "POST", auth: true }),
      revoke: (userId) => request<AccountInvitation>(`/users/${userId}/invitations/revoke`, { method: "POST", auth: true }),
    },
    producerMemberships: {
      list: (userId) => request<ProducerMembership[]>(`/users/${userId}/producer_memberships`, { auth: true }),
      create: (userId, producerId, membershipType) =>
        request<ProducerMembership>(`/users/${userId}/producer_memberships`, {
          method: "POST",
          auth: true,
          body: { producer_membership: { producer_id: producerId, membership_type: membershipType } },
        }),
      update: (userId, membershipId, membershipType) =>
        request<ProducerMembership>(`/users/${userId}/producer_memberships/${membershipId}`, {
          method: "PATCH",
          auth: true,
          body: { producer_membership: { membership_type: membershipType } },
        }),
      destroy: (userId, membershipId) => request(`/users/${userId}/producer_memberships/${membershipId}`, { method: "DELETE", auth: true }),
    },
  }
}

export function createInvitationsApi(request: ApiRequester) {
  return {
    validate: (token: string) => request<InvitationValidationResponse>("/invitations/validate", {
      method: "POST", body: { token },
    }),
    accept: (payload: { token: string; password: string; password_confirmation: string }) =>
      request<{ message: string; email: string }>("/invitations/accept", { method: "POST", body: payload }),
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
    myProducers: () => request<ProducerSummary[]>("/account/producers", { auth: true }),
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
