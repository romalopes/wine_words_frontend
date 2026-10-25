import type { ApiRequester } from "./apiClient"
import type { Follow, FollowStatus, FollowStatuses, FollowableType, FollowWritePayload } from "../types/follow"

export type { ApiRequester } from "./apiClient"

/** All follow target types the API accepts, mapped from the UI kinds. */
export const FOLLOWABLE_TYPES: readonly FollowableType[] = [
  "Producer",
  "Wine",
  "Review",
  "Article",
]

function isValidType(type: string | undefined | null): type is FollowableType {
  return FOLLOWABLE_TYPES.includes(type as FollowableType)
}

export interface NotificationPreferences {
  follow_in_app: boolean
  follow_email: boolean
  digest_cadence: "none" | "daily" | "weekly"
  digest_last_sent_at: string | null
}

export interface FollowsApi {
  /** The signed-in user's follows, optionally filtered by type. */
  list(params?: { type?: FollowableType; page?: number; per_page?: number }): Promise<{
    items: Follow[]
    page: number
    per_page: number
    total_count: number
    total_pages: number
  }>
  /** Follow a target. Idempotent: repeats resolve to the same row. */
  follow(payload: FollowWritePayload): Promise<Follow>
  /** Unfollow by follow id. */
  unfollow(id: number): Promise<{ following: boolean }>
  /** The current user's follow state for one target. */
  status(type: FollowableType, identifier: number | string): Promise<FollowStatus>
  /** Batch follow state for list pages. */
  statuses(type: FollowableType, ids: Array<number | string>): Promise<FollowStatuses>
  /** Follow-notification delivery preferences (issue #192 phase 8). */
  preferences(): Promise<NotificationPreferences>
  updatePreferences(patch: Partial<Omit<NotificationPreferences, "digest_last_sent_at">>): Promise<NotificationPreferences>
}

export function createFollowsApi(request: ApiRequester): FollowsApi {
  return {
    list(params) {
      const query = new URLSearchParams()
      if (params?.type) query.set("type", params.type)
      if (params?.page != null) query.set("page", String(params.page))
      if (params?.per_page != null) query.set("per_page", String(params.per_page))
      const qs = query.toString()
      return request(`/follows${qs ? `?${qs}` : ""}`, { auth: true })
    },
    follow(payload) {
      return request<Follow>("/follows", { method: "POST", auth: true, body: payload as unknown as Record<string, never> })
    },
    unfollow(id) {
      return request<{ following: boolean }>(`/follows/${id}`, { method: "DELETE", auth: true })
    },
    status(type, identifier) {
      if (!isValidType(type)) return Promise.reject(new Error(`Unknown followable type: ${type}`))
      const identifierKey = String(identifier)
      const identifierParam =
        typeof identifier === "number" || /^\d+$/.test(identifierKey)
          ? "followable_id"
          : "followable_slug"
      const query = new URLSearchParams({
        followable_type: type,
        [identifierParam]: identifierKey,
      })
      return request<FollowStatus>(`/follows/status?${query.toString()}`, { auth: true })
    },
    statuses(type, ids) {
      if (!isValidType(type)) return Promise.reject(new Error(`Unknown followable type: ${type}`))
      const query = new URLSearchParams({ followable_type: type })
      ids.forEach((id) => query.append("ids[]", String(id)))
      return request<FollowStatuses>(`/follows/statuses?${query.toString()}`, { auth: true })
    },
    preferences() {
      return request<NotificationPreferences>("/account/notification_preferences", { auth: true })
    },
    updatePreferences(patch) {
      return request<NotificationPreferences>("/account/notification_preferences", {
        method: "PATCH",
        auth: true,
        body: patch as unknown as Record<string, never>,
      })
    },
  }
}