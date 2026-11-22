import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { tradeApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { canManageAllPackages } from "../constants/roles";
import DetailHero from "./DetailHero";
import { formatDate, formatDateTime } from "../utils/dates";
import tradeStyles from "./trade.module.css";
import styles from "./winePackages.module.css";
import type { InvoiceListItem } from "../types/trade";

/**
 * Settings → Invoices (IDENTITY_214).
 *
 * Staff-wide overview of every recorded invoice across all wine packages:
 * client, package relationship, status and email delivery state. Admins and
 * Editors only — the API enforces the same rule. Actions reuse the per-package
 * invoice endpoints so "Email" / "Download" behave exactly like the billing
 * panel (re-sending is allowed and counted).
 */
export default function InvoicesList() {
  const { user } = useAuth();
  const allowed = canManageAllPackages(user);

  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(allowed);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<Record<number, boolean>>({});
  const [sending, setSending] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInvoices(await tradeApi.listInvoices());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  async function handleDownload(invoice: InvoiceListItem) {
    setDownloading((prev) => ({ ...prev, [invoice.id]: true }));
    setError(null);
    setNotice(null);
    try {
      const blob = await tradeApi.downloadInvoicePdf(
        invoice.wine_package.id,
        invoice.id,
      );
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
    } finally {
      setDownloading((prev) => ({ ...prev, [invoice.id]: false }));
    }
  }

  async function handleEmail(invoice: InvoiceListItem) {
    const recipient = invoice.client.email || "the owner";
    if (!window.confirm(`Send invoice ${invoice.invoice_number} to ${recipient} again?`)) {
      return;
    }
    setSending((prev) => ({ ...prev, [invoice.id]: true }));
    setError(null);
    setNotice(null);
    try {
      await tradeApi.sendInvoiceEmail(invoice.wine_package.id, invoice.id);
      await load();
      setNotice(`Invoice ${invoice.invoice_number} emailed to ${recipient}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send the invoice email");
    } finally {
      setSending((prev) => ({ ...prev, [invoice.id]: false }));
    }
  }

  function statusBadgeClass(status: string) {
    switch (status) {
      case "paid":
        return `${tradeStyles.statusBadge} ${tradeStyles["statusBadge--paid"]}`;
      case "sent":
        return `${tradeStyles.statusBadge} ${tradeStyles["statusBadge--sent"]}`;
      case "cancelled":
        return `${tradeStyles.statusBadge} ${tradeStyles["statusBadge--cancelled"]}`;
      case "draft":
        return `${tradeStyles.statusBadge} ${tradeStyles["statusBadge--draft"]}`;
      default:
        return tradeStyles.statusBadge;
    }
  }

  function money(amount: string | number | null | undefined, currency: string) {
    if (amount === null || amount === undefined) return "—";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }

  if (!allowed) {
    return (
      <div className="wine-app">
        <DetailHero
          title="Invoices"
          intro="This page is restricted to Editor and Admin accounts."
        />
      </div>
    );
  }

  return (
    <div className="wine-app">
      <DetailHero
        title="Invoices"
        intro="Every recorded review-fee invoice across all wine packages — email or download any invoice again."
      />
      <div className={tradeStyles.card}>
        {error && (
          <div className={tradeStyles.error} role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className={tradeStyles.success} role="status">
            {notice}
          </div>
        )}
        {loading ? (
          <p className={tradeStyles.muted}>Loading invoices…</p>
        ) : invoices.length === 0 ? (
          <p className={tradeStyles.muted}>No invoices recorded yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Relationship</th>
                  <th>Bottles</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Issued / Due</th>
                  <th>Emailed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    downloading={downloading[invoice.id]}
                    sending={sending[invoice.id]}
                    onDownload={handleDownload}
                    onEmail={handleEmail}
                    badgeClass={statusBadgeClass(invoice.status)}
                    money={money}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

interface InvoiceRowProps {
  invoice: InvoiceListItem;
  downloading?: boolean;
  sending?: boolean;
  onDownload: (invoice: InvoiceListItem) => void;
  onEmail: (invoice: InvoiceListItem) => void;
  badgeClass: string;
  money: (amount: string | number | null | undefined, currency: string) => string;
}

function InvoiceRow({
  invoice,
  downloading,
  sending,
  onDownload,
  onEmail,
  badgeClass,
  money,
}: InvoiceRowProps) {
  return (
    <tr>
      <td>
        <strong>#{invoice.invoice_number}</strong>
        {invoice.payment_source === "stripe" && (
          <div className={tradeStyles.muted}>Stripe</div>
        )}
      </td>
      <td>
        <strong>{invoice.client.company_name || "—"}</strong>
        {invoice.client.contact_name && (
          <div className={tradeStyles.muted}>{invoice.client.contact_name}</div>
        )}
        {invoice.client.email && (
          <div className={tradeStyles.muted}>{invoice.client.email}</div>
        )}
      </td>
      <td>
        <Link
          to={`/wine-packages/${invoice.wine_package.id}`}
          className="wine-link"
        >
          Wine package #{invoice.wine_package.id}
        </Link>
        {invoice.wine_package.producer_name && (
          <div className={tradeStyles.muted}>
            {invoice.wine_package.producer_name}
            {" · "}
            {invoice.wine_package.item_count} wine line(s)
          </div>
        )}
      </td>
      <td>{invoice.billable_bottle_count ?? "—"}</td>
      <td>
        <strong>{money(invoice.total, invoice.currency)}</strong>
      </td>
      <td>
        <span className={badgeClass}>
          {invoice.status}
          {invoice.overdue ? " (Overdue)" : ""}
        </span>
        {invoice.paid_at && (
          <div className={tradeStyles.muted}>
            Paid {formatDate(invoice.paid_at)}
          </div>
        )}
      </td>
      <td>
        {formatDate(invoice.issued_at) || "—"}
        <div className={tradeStyles.muted}>
          Due {formatDate(invoice.due_at) || "—"}
        </div>
      </td>
      <td>
        {invoice.email_sent_at ? (
          <>
            {formatDateTime(invoice.email_sent_at)}
            <div className={tradeStyles.muted}>
              {invoice.email_send_count} send(s)
            </div>
          </>
        ) : (
          <span className={tradeStyles.muted}>—</span>
        )}
      </td>
      <td>
        <div className={styles.rowActions}>
          <button
            type="button"
            className="wine-btn wine-btn--secondary wine-btn--sm"
            disabled={downloading}
            onClick={() => onDownload(invoice)}
          >
            {downloading ? "Downloading…" : "Download"}
          </button>
          {(invoice.status === "sent" || invoice.status === "draft") && (
            <button
              type="button"
              className="wine-btn wine-btn--primary wine-btn--sm"
              disabled={sending}
              onClick={() => onEmail(invoice)}
            >
              {sending ? "Sending…" : "Email"}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
