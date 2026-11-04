import type { ApiRequester } from "./apiClient"

export interface PushSubscriptionRecord {
  id: number
  endpoint: string
  user_agent: string | null
  last_used_at: string | null
}

export function createPushSubscriptionsApi(request: ApiRequester) {
  return {
    list() {
      return request<PushSubscriptionRecord[]>("/push_subscriptions", { auth: true })
    },
    vapidPublicKey() {
      return request<{ public_key: string | null }>("/push_subscriptions/vapid_public_key", {
        auth: true,
      })
    },
    create(payload: { endpoint: string; p256dh: string; auth: string }) {
      return request<PushSubscriptionRecord>("/push_subscriptions", {
        method: "POST",
        auth: true,
        body: { push_subscription: payload },
      })
    },
    remove(id: number) {
      return request<void>(`/push_subscriptions/${id}`, { method: "DELETE", auth: true })
    },
  }
}