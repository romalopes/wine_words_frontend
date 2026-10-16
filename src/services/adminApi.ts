import type { ResourceResponse } from "../types/common"
import type {
  ConfigurationApi,
  ConfigurationUpdatePayload,
  EmailVerificationsApi,
  ImpersonationApi,
  LogsApi,
  SettingsApi,
  TestAccessApi,
  TestAccessResponse,
} from "../types/api"
import type { Configuration, Setting } from "../types/notification"
import type { AuditLog, ImpersonationResponse } from "../types/user"
import type { ApiRequester } from "./apiClient"
import { buildQuery } from "./apiClient"
import { retryOnce } from "../utils/retry"

export function createLogsApi(request: ApiRequester): LogsApi {
  return {
    fetchLines: (lines = 500) => request<{ logs: string[] }>(`/logs?lines=${lines}`, { auth: true }),
    fetchAuditLogs: (params = {}) => request<ResourceResponse<AuditLog>>(`/logs/audit${buildQuery(params)}`, { auth: true }),
    fetchAuditLog: (id) => request<AuditLog>(`/logs/${id}`, { auth: true }),
  }
}

export function createImpersonationApi(request: ApiRequester): ImpersonationApi {
  return {
    start: (userId) => request<ImpersonationResponse>("/impersonation", { method: "POST", auth: true, body: { user_id: userId } }),
    stop: () => request<ImpersonationResponse>("/impersonation", { method: "DELETE", auth: true }),
    status: () => request<ImpersonationResponse>("/impersonation/status", { auth: true }),
  }
}

export function createConfigurationApi(request: ApiRequester): ConfigurationApi {
  return {
    fetch: () => request<Configuration>("/configuration", { auth: true }),
    update: (payload: ConfigurationUpdatePayload) => request<Configuration>("/configuration", { method: "PATCH", auth: true, body: payload as unknown as Record<string, never> }),
  }
}

export function createEmailVerificationsApi(request: ApiRequester): EmailVerificationsApi {
  return {
    verify: (token) => request(`/email-verifications/${encodeURIComponent(token)}`),
    resend: (emailAddress) => request("/email-verifications/resend", { method: "POST", body: { email_address: emailAddress } }),
  }
}

export function createSettingsApi(request: ApiRequester): SettingsApi {
  return {
    list: () => request<Setting[]>("/configuration/settings", { auth: true }),
    create: ({ key, value }) => request<Setting>("/configuration/settings", { method: "POST", auth: true, body: { key, value: value as never } }),
    update: (id, { value }) => request<Setting>(`/configuration/settings/${id}`, { method: "PATCH", auth: true, body: { value: value as never } }),
    destroy: (id) => request(`/configuration/settings/${id}`, { method: "DELETE", auth: true }),
  }
}

export function createTestAccessApi(request: ApiRequester): TestAccessApi {
  return {
    submit: (password) => request<TestAccessResponse>("/test_access", { method: "POST", body: { password } }),
    // Boot probe fired on every page load: a transient 404 while the dev
    // server draws its routes must not surface as console noise (a 401 gate
    // rejection is not transient and still fails fast).
    verify: () => retryOnce(() => request<TestAccessResponse>("/test_access")),
  }
}
