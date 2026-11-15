import type { ApiRequester } from "./apiClient"
import type {
  TradeMessage,
  TradePackage,
  TradeSubmissionResponse,
} from "../types/trade"

export function createTradeApi(request: ApiRequester) {
  return {
    submit(payload: Record<string, unknown>, idempotencyKey: string) {
      return request<TradeSubmissionResponse>("/trade/submissions", {
        method: "POST",
        body: payload as never,
        headers: { "X-Idempotency-Key": idempotencyKey },
      })
    },
    listPackages() {
      return request<TradePackage[]>("/trade/my-packages", { auth: true })
    },
    getPackage(id: string | number) {
      return request<TradePackage>(`/trade/packages/${id}`, { auth: true })
    },
    getGuestPackage(token: string) {
      return request<TradePackage>(`/trade/guest_packages/${encodeURIComponent(token)}`)
    },
    claimGuestPackage(token: string) {
      return request<TradePackage>(`/trade/guest_packages/${encodeURIComponent(token)}/claim`, {
        method: "POST",
        auth: true,
      })
    },
    listMessages(packageId: string | number, guestToken?: string) {
      const query = guestToken ? `?guest_token=${encodeURIComponent(guestToken)}` : ""
      return request<TradeMessage[]>(`/trade/packages/${packageId}/messages${query}`, {
        auth: !guestToken,
      })
    },
    sendMessage(packageId: string | number, body: string, guestToken?: string) {
      const query = guestToken ? `?guest_token=${encodeURIComponent(guestToken)}` : ""
      return request<TradeMessage>(`/trade/packages/${packageId}/messages${query}`, {
        method: "POST",
        auth: !guestToken,
        body: { body },
      })
    },
    checkout(invoiceId: string | number, guestToken?: string) {
      const query = guestToken ? `?guest_token=${encodeURIComponent(guestToken)}` : ""
      return request<{ checkout_url: string }>(`/trade/invoices/${invoiceId}/checkout${query}`, {
        method: "POST",
        auth: !guestToken,
        body: {
          success_url: `${window.location.origin}/trade/payment/success`,
          cancel_url: `${window.location.origin}/trade/payment/cancel`,
        },
      })
    },
  }
}