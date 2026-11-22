import { useCallback, useEffect, useState } from "react";
import { tradeApi } from "../services/api";
import type { TradeBillingSummary } from "../types/trade";
import { formatDateTime } from "../utils/dates";
import styles from "./trade.module.css";

/**
 * Staff billing panel for a wine package (IDENTITY_214).
 *
 * Shows the billing summary (submitted vs billable bottles, invoiced/paid/
 * outstanding), lets staff confirm the billable bottle count, create manual
 * invoices, and per-invoice: download the PDF, email it to the owner, mark it
 * paid or cancel/waive it with a reason. Used by both the trade admin page
 * (/admin/trade/packages/:id) and the editorial package page (/wine-packages/:id).
 */
export default function WinePackageBillingPanel({
  packageId,
  onChanged,
  readOnly = false,
}: {
  packageId: number
  onChanged?: () => void
  /** When true, hides all mutating actions (confirm billable, create invoice,
   *  email, mark paid, cancel) so owners/guests can only view billing state. */
  readOnly?: boolean
}) {
  const [summary, setSummary] = useState<TradeBillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmBillableCount, setConfirmBillableCount] = useState("");
  const [confirmingBillable, setConfirmingBillable] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<Record<number, boolean>>({});
  const [markingPaid, setMarkingPaid] = useState<Record<number, boolean>>({});
  const [cancellingInvoice, setCancellingInvoice] = useState<Record<number, boolean>>({});
  const [cancellationReason, setCancellationReason] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await tradeApi.getBillingSummary(packageId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load billing summary",
      );
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  useEffect(() => {
    load();
  }, [load]);

  // Pre-fill the billable count with the submitted total whenever new bottles
  // have arrived since the last confirmation, so the follow-up-invoice flow
  // is one click: "Update billable count" → "Invoice N additional bottle(s)".
  useEffect(() => {
    if (
      summary &&
      (summary.bottles_submitted ?? 0) > (summary.billable_to_date || 0)
    ) {
      setConfirmBillableCount(String(summary.bottles_submitted));
    }
  }, [summary]);

  async function handleConfirmBillable() {
    const count = parseInt(confirmBillableCount, 10);
    if (Number.isNaN(count) || count <= 0) {
      setError("Please enter a valid positive bottle count.");
      return;
    }
    setConfirmingBillable(true);
    setError(null);
    try {
      setSummary(await tradeApi.confirmBillableQuantity(packageId, count));
      setConfirmBillableCount("");
      if (onChanged) onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to confirm billable quantity");
    } finally {
      setConfirmingBillable(false);
    }
  }

  async function handleCreateInvoice(coverage: "difference" | "full" = "difference") {
    setCreatingInvoice(true);
    setError(null);
    setNotice(null);
    try {
      await tradeApi.createInvoice(packageId, {
        due_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        coverage,
      });
      await load();
      setNotice(
        coverage === "full"
          ? "Invoice created covering the full billable amount."
          : "Invoice created for the uninvoiced bottles.",
      );
      if (onChanged) onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create invoice");
    } finally {
      setCreatingInvoice(false);
    }
  }

  async function handleSendInvoiceEmail(invoiceId: number) {
    setSendingEmail((prev) => ({ ...prev, [invoiceId]: true }));
    setError(null);
    setNotice(null);
    try {
      const result = await tradeApi.sendInvoiceEmail(packageId, invoiceId);
      await load();
      setNotice(result.message || "Invoice email sent to the owner.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send invoice email");
    } finally {
      setSendingEmail((prev) => ({ ...prev, [invoiceId]: false }));
    }
  }

  async function handleMarkInvoicePaid(invoiceId: number) {
    setMarkingPaid((prev) => ({ ...prev, [invoiceId]: true }));
    setError(null);
    try {
      await tradeApi.markInvoicePaid(packageId, invoiceId);
      await load();
      if (onChanged) onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to mark invoice paid");
    } finally {
      setMarkingPaid((prev) => ({ ...prev, [invoiceId]: false }));
    }
  }

  async function handleCancelInvoice(invoiceId: number) {
    const reason = cancellationReason[invoiceId]?.trim();
    if (!reason) {
      setError("Cancellation reason is required.");
      return;
    }
    setCancellingInvoice((prev) => ({ ...prev, [invoiceId]: true }));
    setError(null);
    try {
      await tradeApi.cancelInvoice(packageId, invoiceId, reason);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel invoice");
    } finally {
      setCancellingInvoice((prev) => ({ ...prev, [invoiceId]: false }));
      setCancellationReason((prev) => ({ ...prev, [invoiceId]: "" }));
    }
  }

  async function handleDownloadInvoicePdf(invoice: { id: number; invoice_number: string }) {
    setError(null);
    try {
      const blob = await tradeApi.downloadInvoicePdf(packageId, invoice.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoice.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to download the invoice PDF");
    }
  }

  function formatCurrency(amount: string | number, currency: string) {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }

  function getPaymentStateLabel(state: string) {
    const labels: Record<string, string> = {
      not_invoiced: "Not invoiced",
      invoiced: "Invoiced",
      partially_paid: "Partially paid",
      settled: "Settled",
    };
    return labels[state] || state;
  }

  function getStatusBadgeClass(status: string) {
    switch (status) {
      case "paid":
        return `${styles.statusBadge} ${styles["statusBadge--paid"]}`;
      case "sent":
        return `${styles.statusBadge} ${styles["statusBadge--sent"]}`;
      case "draft":
        return `${styles.statusBadge} ${styles["statusBadge--draft"]}`;
      case "cancelled":
        return `${styles.statusBadge} ${styles["statusBadge--cancelled"]}`;
      default:
        return styles.statusBadge;
    }
  }

  return (
    <section className={styles.card}>
      <h2>Billing</h2>
      {error && <div className={styles.error} role="alert">{error}</div>}
      {notice && <div className={styles.success} role="status">{notice}</div>}
      {loading && <p className={styles.muted}>Loading billing…</p>}

      {summary && (
        <>
          <div className={styles.billingSummary}>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Bottles submitted</span>
                <span className={styles.summaryValue}>{summary.bottles_submitted}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Billable to date</span>
                <span className={styles.summaryValue}>{summary.billable_to_date}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Total invoiced</span>
                <span className={styles.summaryValue}>
                  {formatCurrency(summary.total_invoiced, summary.invoices[0]?.currency || "AUD")}
                </span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Total paid</span>
                <span className={styles.summaryValue}>
                  {formatCurrency(summary.total_paid, summary.invoices[0]?.currency || "AUD")}
                </span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Outstanding</span>
                <span
                  className={styles.summaryValue}
                  style={{
                    color:
                      summary.outstanding && parseFloat(summary.outstanding) > 0
                        ? "#8a2238"
                        : "inherit",
                  }}
                >
                  {formatCurrency(summary.outstanding, summary.invoices[0]?.currency || "AUD")}
                </span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Payment state</span>
                <span className={styles.summaryValue}>
                  <span
                    className={
                      styles.statusBadge +
                      " " +
                      (styles[`statusBadge--${summary.payment_state}`] || "")
                    }
                  >
                    {getPaymentStateLabel(summary.payment_state)}
                  </span>
                  {summary.overdue && (
                    <span className={`${styles.statusBadge} ${styles["statusBadge--overdue"]}`}>
                      Overdue
                    </span>
                  )}
                </span>
              </div>
            </div>

            {!readOnly &&
              (!summary.billable_to_date ||
                summary.billable_to_date === 0 ||
                (summary.bottles_submitted ?? 0) > summary.billable_to_date) && (
              <div className={styles.billingAction}>
                <h3>
                  {summary.billable_to_date
                    ? "Update billable count"
                    : "Confirm billable bottle count"}
                </h3>
                <div className={styles.field}>
                  <label htmlFor="confirm-billable-count">Billable bottles</label>
                  <input
                    id="confirm-billable-count"
                    type="number"
                    min="1"
                    value={confirmBillableCount}
                    onChange={(e) => setConfirmBillableCount(e.target.value)}
                    disabled={confirmingBillable}
                  />
                  {summary.bottles_submitted > 0 && (
                    <span className={styles.muted}>
                      Submitted: {summary.bottles_submitted} bottle(s)
                      {summary.billable_to_date > 0 &&
                        summary.bottles_submitted > summary.billable_to_date &&
                        ` — ${summary.bottles_submitted - summary.billable_to_date} new bottle(s) arrived since the count was last confirmed`}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="wine-btn wine-btn--primary"
                  disabled={confirmingBillable || !confirmBillableCount.trim()}
                  onClick={handleConfirmBillable}
                >
                  {confirmingBillable
                    ? "Confirming…"
                    : summary.billable_to_date
                      ? "Update billable count"
                      : "Confirm billable count"}
                </button>
              </div>
            )}

            {!readOnly &&
              summary.billable_to_date > 0 &&
              (summary.billable_uninvoiced ?? 0) > 0 && (
              <div className={styles.billingAction}>
                <h3>Create invoice</h3>
                {(summary.invoices.filter((inv) => inv.status === "sent" || inv.status === "paid").length > 0) ? (
                  <>
                    <p className={styles.muted}>
                      {summary.billable_uninvoiced} billable bottle(s) are not covered by an
                      active invoice yet. Invoice just the difference, or re-issue one
                      consolidated invoice for the whole billable amount.
                    </p>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className="wine-btn wine-btn--primary"
                        disabled={creatingInvoice}
                        onClick={() => handleCreateInvoice("difference")}
                      >
                        {creatingInvoice
                          ? "Creating invoice…"
                          : `Invoice ${summary.billable_uninvoiced} additional bottle(s)`}
                      </button>
                      <button
                        type="button"
                        className="wine-btn wine-btn--secondary"
                        disabled={creatingInvoice}
                        onClick={() => handleCreateInvoice("full")}
                      >
                        {creatingInvoice
                          ? "Creating invoice…"
                          : `Invoice all ${summary.billable_to_date} bottles (full)`}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className={styles.muted}>
                      Create an invoice for {summary.billable_uninvoiced} billable bottle(s).
                    </p>
                    <button
                      type="button"
                      className="wine-btn wine-btn--primary"
                      disabled={creatingInvoice}
                      onClick={() => handleCreateInvoice("difference")}
                    >
                      {creatingInvoice ? "Creating invoice…" : "Create invoice"}
                    </button>
                  </>
                )}
              </div>
            )}



            <h3>Invoices</h3>
            {summary.invoices.length === 0 ? (
              <p className={styles.muted}>No invoices recorded yet.</p>
            ) : (
              <div className={styles.invoiceList}>
                {summary.invoices.map((invoice) => (
                  <div key={invoice.id} className={styles.invoiceCard}>
                    <div className={styles.invoiceHeader}>
                      <div>
                        <strong>Invoice #{invoice.invoice_number}</strong>{" "}
                        <span className={getStatusBadgeClass(invoice.status)}>
                          {invoice.status}
                          {invoice.overdue ? " (Overdue)" : ""}
                        </span>
                      </div>
                      <div className={styles.invoiceMeta}>
                        {invoice.due_at && <span>Due: {formatDateTime(invoice.due_at)}</span>}
                        {invoice.paid_at && (
                          <span className={styles.paidBadge}>
                            Paid {formatDateTime(invoice.paid_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.invoiceDetails}>
                      <div className={styles.invoiceDetail}>
                        <span className={styles.muted}>Bottles:</span>
                        <span>{invoice.billable_bottle_count || 0}</span>
                      </div>
                      <div className={styles.invoiceDetail}>
                        <span className={styles.muted}>Unit fee:</span>
                        <span>{formatCurrency(invoice.unit_fee || 0, invoice.currency)}</span>
                      </div>
                      <div className={styles.invoiceDetail}>
                        <span className={styles.muted}>Total:</span>
                        <span>
                          <strong>{formatCurrency(invoice.total, invoice.currency)}</strong>
                        </span>
                      </div>
                      {invoice.email_sent_at && (
                        <div className={styles.invoiceDetail}>
                          <span className={styles.muted}>Emailed:</span>
                          <span>
                            {formatDateTime(invoice.email_sent_at)} ({invoice.email_send_count}x)
                          </span>
                        </div>
                      )}
                    </div>


                    <div className={styles.invoiceActions}>
                      <button
                        type="button"
                        className="wine-btn wine-btn--secondary"
                        onClick={() => handleDownloadInvoicePdf(invoice)}
                      >
                        Download PDF
                      </button>
                      {!readOnly &&
                        (invoice.status === "sent" || invoice.status === "draft") && (
                        <button
                          type="button"
                          className="wine-btn wine-btn--primary"
                          disabled={sendingEmail[invoice.id]}
                          onClick={() => handleSendInvoiceEmail(invoice.id)}
                        >
                          {sendingEmail[invoice.id] ? "Sending…" : "Email invoice"}
                        </button>
                      )}
                      {!readOnly && invoice.status === "sent" && (
                        <button
                          type="button"
                          className="wine-btn wine-btn--success"
                          disabled={markingPaid[invoice.id]}
                          onClick={() => handleMarkInvoicePaid(invoice.id)}
                        >
                          {markingPaid[invoice.id] ? "Marking paid…" : "Mark paid"}
                        </button>
                      )}
                      {!readOnly &&
                        (invoice.status === "sent" || invoice.status === "draft") &&
                        (cancellingInvoice[invoice.id] ? (
                          <span className={styles.cancelInline}>
                            <input
                              type="text"
                              placeholder="Reason (required)"
                              value={cancellationReason[invoice.id] || ""}
                              autoFocus
                              onChange={(e) =>
                                setCancellationReason((prev) => ({
                                  ...prev,
                                  [invoice.id]: e.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              className="wine-btn wine-btn--secondary"
                              disabled={!cancellationReason[invoice.id]?.trim()}
                              onClick={() => handleCancelInvoice(invoice.id)}
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              className="wine-btn wine-btn--ghost"
                              onClick={() => {
                                setCancellingInvoice((prev) => ({
                                  ...prev,
                                  [invoice.id]: false,
                                }));
                                setCancellationReason((prev) => ({
                                  ...prev,
                                  [invoice.id]: "",
                                }));
                              }}
                            >
                              Dismiss
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="wine-btn wine-btn--danger"
                            onClick={() => {
                              setCancellingInvoice((prev) => ({
                                ...prev,
                                [invoice.id]: true,
                              }));
                              setCancellationReason((prev) => ({
                                ...prev,
                                [invoice.id]: "",
                              }));
                            }}
                          >
                            Cancel invoice
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

