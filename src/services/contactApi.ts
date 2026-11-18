import type { ApiRequester } from "./apiClient"
import type { QueryParams } from "../types/common"
import type {
  ContactMessage,
  ContactMessageInput,
  ContactMessageListResponse,
  ContactMessageReceipt,
  ContactMessageStatus,
} from "../types/contact"

/**
 * Public Contact form + internal Contact Messages inbox (IDENTITY_209).
 *
 * `create` is deliberately unauthenticated — visitors have no account. Every
 * inbox call is authenticated; the API enforces Editor/Admin independently of
 * the menu that links here.
 */
export function createContactApi(request: ApiRequester) {
  return {
    create(payload: ContactMessageInput) {
      return request<ContactMessageReceipt>("/contact_messages", {
        method: "POST",
        body: payload as never,
      })
    },
    list(params: QueryParams = {}) {
      const search = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return
        search.set(key, String(value))
      })
      const query = search.toString()
      return request<ContactMessageListResponse>(
        `/admin/contact_messages${query ? `?${query}` : ""}`,
        { auth: true },
      )
    },
    get(id: number | string) {
      return request<ContactMessage>(`/admin/contact_messages/${id}`, { auth: true })
    },
    updateStatus(id: number | string, status: ContactMessageStatus) {
      return request<ContactMessage>(`/admin/contact_messages/${id}`, {
        method: "PATCH",
        auth: true,
        body: { status },
      })
    },
  }
}
