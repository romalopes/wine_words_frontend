import type { ApiRequester } from "./apiClient";
import { buildQuery } from "./apiClient";
import type {
  InvoiceFilters,
  TradeMessage,
  TradePackage,
  TradeSubmissionResponse,
  TradeBillingSummary,
  TradeInvoice,
  InvoiceListItem,
} from "../types/trade";

export function createTradeApi(request: ApiRequester) {
  return {
    // Public pricing endpoint (IDENTITY_214)
    getPricing() {
      return request<{
        wine_review_fee: {
          amount: string;
          currency: string;
          unit: string;
        };
      }>("/trade/pricing");
    },

    // Billing endpoints (IDENTITY_214 Phase 6)
    getBillingSummary(packageId: string | number) {
      return request<TradeBillingSummary>(
        `/wine_packages/${packageId}/billing`,
        { auth: true },
      );
    },

    // Build query string from InvoiceFilters params
    buildInvoiceQuery(params: InvoiceFilters): string {
      const query = new URLSearchParams();
      if (params.status && params.status !== "all") query.set("status", params.status);
      if (params.email_sent) query.set("email_sent", params.email_sent);
      if (params.start_date) query.set("start_date", params.start_date);
      if (params.end_date) query.set("end_date", params.end_date);
      if (params.payment_source) query.set("payment_source", params.payment_source);
      if (params.overdue !== undefined) query.set("overdue", String(params.overdue));
      return query.toString();
    },

    // Staff-wide invoice overview (Settings → Invoices)
    listInvoices(params: InvoiceFilters = {}) {
      const queryString = this.buildInvoiceQuery(params);
      const path = queryString ? `/invoices?${queryString}` : "/invoices";
      return request<InvoiceListItem[]>(path, { auth: true });
    },

    downloadInvoiceReport(params: InvoiceFilters = {}) {
      const queryString = this.buildInvoiceQuery(params);
      const path = queryString ? `/invoices/report?${queryString}` : "/invoices/report";
      return request<Blob>(path, { auth: true });
    },

    confirmBillableQuantity(packageId: string | number, count: number) {
      return request<TradeBillingSummary>(
        `/wine_packages/${packageId}/billing`,
        {
          method: "PATCH",
          auth: true,
          body: { billable_bottle_count: count },
        },
      );
    },

    createInvoice(
      packageId: string | number,
      payload: {
        due_at?: string;
        notes?: string;
        coverage?: "difference" | "full";
      },
    ) {
      return request<TradeInvoice>(`/wine_packages/${packageId}/invoices`, {
        method: "POST",
        auth: true,
        body: payload,
      });
    },

    sendInvoiceEmail(packageId: string | number, invoiceId: string | number) {
      return request<{ queued: boolean; message: string }>(
        `/wine_packages/${packageId}/invoices/${invoiceId}/send_email`,
        {
          method: "POST",
          auth: true,
        },
      );
    },

    markInvoicePaid(packageId: string | number, invoiceId: string | number) {
      return request<TradeInvoice>(
        `/wine_packages/${packageId}/invoices/${invoiceId}/mark_paid`,
        {
          method: "POST",
          auth: true,
        },
      );
    },

    cancelInvoice(
      packageId: string | number,
      invoiceId: string | number,
      reason: string,
    ) {
      return request<TradeInvoice>(
        `/wine_packages/${packageId}/invoices/${invoiceId}/cancel`,
        {
          method: "POST",
          auth: true,
          body: { cancellation_reason: reason },
        },
      );
    },

    downloadInvoicePdf(packageId: string | number, invoiceId: string | number) {
      return request<Blob>(
        `/wine_packages/${packageId}/invoices/${invoiceId}/pdf`,
        {
          auth: true,
        },
      );
    },

    checkEmail(email: string) {
      // `request()` has no `query` option — query strings are built into the
      // path, as every other namespace does. Dropping the email here made the
      // backend answer 400 for a blank lookup.
      return request<{ exists: boolean }>(
        `/trade/submissions/check_email${buildQuery({ email })}`,
      );
    },
    submit(payload: Record<string, unknown>, idempotencyKey: string) {
      return request<TradeSubmissionResponse>("/trade/submissions", {
        method: "POST",
        body: payload as never,
        headers: { "X-Idempotency-Key": idempotencyKey },
      });
    },
    // Staff (Editor/Admin) view of one trade submission — the page the staff
    // notification links to. The endpoint itself is role-guarded server-side.
    getStaffPackage(id: string | number) {
      return request<TradePackage>(`/admin/trade/packages/${id}`, {
        auth: true,
      });
    },
    // Staff list of trade submissions with filtering/pagination.
    listStaffPackages(params?: {
      status?: string;
      q?: string;
      page?: number;
      per_page?: number;
    }) {
      const query = new URLSearchParams();
      if (params?.status) query.set("status", params.status);
      if (params?.q) query.set("q", params.q);
      if (params?.page) query.set("page", String(params.page));
      if (params?.per_page) query.set("per_page", String(params.per_page));
      return request<{
        packages: TradePackage[];
        meta: { limit: number; offset: number; total_count: number };
      }>(`/admin/trade/packages?${query.toString()}`, { auth: true });
    },
    // Staff conversation with the submitter: reading the thread and replying.
    // Every reply notifies the submitter (email + in-app when they have an
    // account), handled by Trade::Messages::Send server-side.
    getStaffMessages(packageId: string | number) {
      return request<TradeMessage[]>(
        `/admin/trade/packages/${packageId}/messages`,
        { auth: true },
      );
    },
    sendStaffMessage(packageId: string | number, body: string) {
      return request<TradeMessage>(
        `/admin/trade/packages/${packageId}/messages`,
        { method: "POST", auth: true, body: { body } },
      );
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
      );
    },
    listPackages() {
      return request<TradePackage[]>("/trade/my-packages", { auth: true });
    },
    getPackage(id: string | number) {
      return request<TradePackage>(`/trade/packages/${id}`, { auth: true });
    },
    /** Links an unclaimed guest submission to the signed-in account (by email). */
    claimPackage(id: string | number) {
      return request<TradePackage>(`/trade/packages/${id}/claim`, {
        method: "POST",
        auth: true,
      });
    },
    getGuestPackage(token: string) {
      return request<TradePackage>(
        `/trade/guest_packages/${encodeURIComponent(token)}`,
      );
    },
    claimGuestPackage(token: string) {
      return request<TradePackage>(
        `/trade/guest_packages/${encodeURIComponent(token)}/claim`,
        {
          method: "POST",
          auth: true,
        },
      );
    },
    listMessages(packageId: string | number, guestToken?: string) {
      const query = guestToken
        ? `?guest_token=${encodeURIComponent(guestToken)}`
        : "";
      return request<TradeMessage[]>(
        `/trade/packages/${packageId}/messages${query}`,
        {
          auth: !guestToken,
        },
      );
    },
    sendMessage(packageId: string | number, body: string, guestToken?: string) {
      const query = guestToken
        ? `?guest_token=${encodeURIComponent(guestToken)}`
        : "";
      return request<TradeMessage>(
        `/trade/packages/${packageId}/messages${query}`,
        {
          method: "POST",
          auth: !guestToken,
          body: { body },
        },
      );
    },
    checkout(invoiceId: string | number, guestToken?: string) {
      const query = guestToken
        ? `?guest_token=${encodeURIComponent(guestToken)}`
        : "";
      return request<{ checkout_url: string }>(
        `/trade/invoices/${invoiceId}/checkout${query}`,
        {
          method: "POST",
          auth: !guestToken,
          body: {
            success_url: `${window.location.origin}/trade/payment/success`,
            cancel_url: `${window.location.origin}/trade/payment/cancel`,
          },
        },
      );
    },
  };
}
