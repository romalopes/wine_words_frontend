import type { ApiRequester } from "./apiClient"
import { buildQuery } from "./apiClient"
import type {
  TradeMessage,
  TradePackage,
  TradeSubmissionResponse,
} from "../types/trade"

export function createTradeApi(request: ApiRequester) {
  return {
    checkEmail(email: string) {
      // `request()` has no `query` option — query strings are built into the
      // path, as every other namespace does. Dropping the email here made the
      // backend answer 400 for a blank lookup.
      return request<{ exists: boolean }>(
        `/trade/submissions/check_email${buildQuery({ email })}`,
      )
    },
    submit(payload: Record<string, unknown>, idempotencyKey: string) {
      return request<TradeSubmissionResponse>("/trade/submissions", {
        method: "POST",
        body: payload as never,
        headers: { "X-Idempotency-Key": idempotencyKey },
      })
    },
    // Staff (Editor/Admin) view of one trade submission — the page the staff
    // notification links to. The endpoint itself is role-guarded server-side.
    getStaffPackage(id: string | number) {
      return request<TradePackage>(`/admin/trade/packages/${id}`, { auth: true })
    },
    // Staff list of trade submissions with filtering/pagination.
    listStaffPackages(params?: {
      status?: string;
      q?: string;
      page?: number;
      per_page?: number;
    }) {
      const query = new URLSearchParams()
      if (params?.status) query.set("status", params.status)
      if (params?.q) query.set("q", params.q)
      if (params?.page) query.set("page", String(params.page))
      if (params?.per_page) query.set("per_page", String(params.per_page))
      return request<{
        packages: TradePackage[]
        meta: { limit: number; offset: number; total_count: number }
      }>(`/admin/trade/packages?${query.toString()}`, { auth: true })
    },
    // Staff conversation with the submitter: reading the thread and replying.
    // Every reply notifies the submitter (email + in-app when they have an
    // account), handled by Trade::Messages::Send server-side.
    getStaffMessages(packageId: string | number) {
      return request<TradeMessage[]>(
        `/admin/trade/packages/${packageId}/messages`,
        { auth: true },
      )
    },
    sendStaffMessage(packageId: string | number, body: string) {
      return request<TradeMessage>(
        `/admin/trade/packages/${packageId}/messages`,
        { method: "POST", auth: true, body: { body } },
      )
    },
    // Editorial assessment: per-wine decisions sent as approved/rejected.
    // The frontend determines per-wine decisions based on package-level approve/reject.
    assessPackage(
      packageId: string | number,
      payload: {
        decisions: Record<string, "approved" | "rejected">;
        reason?: string | null;
      },
    ) {
      return request<TradePackage>(
        `/admin/trade/packages/${packageId}/assess`,
        { method: "PATCH", auth: true, body: payload },
      )
    },
    listPackages() {
      return request<TradePackage[]>("/trade/my-packages", { auth: true })
    },
    getPackage(id: string | number) {
      return request<TradePackage>(`/trade/packages/${id}`, { auth: true })
    },
    /** Links an unclaimed guest submission to the signed-in account (by email). */
    claimPackage(id: string | number) {
      return request<TradePackage>(`/trade/packages/${id}/claim`, {
        method: "POST",
        auth: true,
      })
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