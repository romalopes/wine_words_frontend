import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { tradeApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { canManageAllPackages } from "../constants/roles";
import PackageStatusBadge from "./PackageStatusBadge";
import { formatDateTime } from "../utils/dates";
import type { TradePackage } from "../types/trade";
import styles from "./trade.module.css";

// Staff view of one trade submission (IDENTITY_206 Phase 7).
//
// Editors and Admins land here from the in-app notification / email created by
// Trade::Submissions::NotifyStaff: the public submitter's contact details, the
// wines they proposed and the full timeline (shared + internal events). The
// endpoint behind it (/api/v1/admin/trade/packages/:id) is role-guarded
// server-side; this page only mirrors that check so the SPA can explain itself.
export default function TradeAdminPackageDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const allowed = canManageAllPackages(user);
  const [pkg, setPkg] = useState<TradePackage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await tradeApi.getStaffPackage(id);
        if (!cancelled) setPkg(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load submission",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, id]);

  if (!allowed) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>
          This page is restricted to Editor and Admin accounts.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>{error}</div>
        <Link to="/notifications" className="wine-btn wine-btn--secondary">
          Back to notifications
        </Link>
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className={styles.page}>
        <p>Loading submission…</p>
      </div>
    );
  }

  const contact = pkg.contact_snapshot;
  const quotes = pkg.quotes ?? [];
  const invoices = pkg.invoices ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1>Trade submission #{pkg.id}</h1>
        <div className={styles.packageStatus}>
          <span className={styles.packageStatusLabel}>Status</span>
          <PackageStatusBadge status={pkg.status} />
          {pkg.submitted_at && (
            <span className={styles.packageStatusHint}>
              Submitted {formatDateTime(pkg.submitted_at)}
            </span>
          )}
        </div>
      </div>

      {contact && (
        <section className={styles.card}>
          <h2>Submitter contact</h2>
          <div className={styles.grid}>
            <div className={styles.field}>
              <span className={styles.muted}>Company</span>
              <strong>{contact.company_name || "—"}</strong>
            </div>
            <div className={styles.field}>
              <span className={styles.muted}>Contact name</span>
              <strong>{contact.contact_name || "—"}</strong>
            </div>
            <div className={styles.field}>
              <span className={styles.muted}>Email</span>
              <strong>
                {contact.email ? (
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                ) : (
                  "—"
                )}
              </strong>
            </div>
            <div className={styles.field}>
              <span className={styles.muted}>Phone</span>
              <strong>{contact.phone || "—"}</strong>
            </div>
            <div className={styles.field}>
              <span className={styles.muted}>Country</span>
              <strong>{contact.country || "—"}</strong>
            </div>
            <div className={styles.field}>
              <span className={styles.muted}>Role</span>
              <strong>{contact.role || "—"}</strong>
            </div>
            <div className={styles.field}>
              <span className={styles.muted}>Website</span>
              <strong>
                {contact.website ? (
                  <a href={contact.website} target="_blank" rel="noreferrer">
                    {contact.website}
                  </a>
                ) : (
                  "—"
                )}
              </strong>
            </div>
            <div className={styles.field}>
              <span className={styles.muted}>Address</span>
              <strong>{contact.address || "—"}</strong>
            </div>
            {contact.notes && (
              <div className={`${styles.field} ${styles.fieldWide}`}>
                <span className={styles.muted}>Submitter notes</span>
                <strong>{contact.notes}</strong>
              </div>
            )}
          </div>
        </section>
      )}

      <section className={styles.card}>
        <h2>Proposed wines ({pkg.items.length})</h2>
        <div className={styles.table}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Wine</th>
                <th>Vintage</th>
                <th>Qty</th>
                <th>Region</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pkg.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.wine_name}</td>
                  <td>{item.vintage || "—"}</td>
                  <td>{item.quantity ?? 1}</td>
                  <td>{item.region || "—"}</td>
                  <td>
                    <span className={styles.status}>
                      {item.item_status.replaceAll("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {pkg.events.length > 0 && (
        <section className={styles.card}>
          <h2>Timeline</h2>
          <div className={styles.timeline}>
            {pkg.events.map((event) => (
              <div key={event.id} className={styles.message}>
                <div className={styles.messageMeta}>
                  {formatDateTime(event.occurred_at)} ·{" "}
                  {event.event_type.replaceAll("_", " ")}
                  {event.internal ? " · internal" : ""}
                </div>
                {event.description && <p>{event.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {(quotes.length > 0 || invoices.length > 0) && (
        <section className={styles.card}>
          <h2>Commercial</h2>
          {quotes.map((quote) => (
            <p key={`quote-${quote.id}`}>
              Quote #{quote.id}: {quote.status} · {quote.total} {quote.currency}
            </p>
          ))}
          {invoices.map((invoice) => (
            <p key={`invoice-${invoice.id}`}>
              Invoice {invoice.invoice_number}: {invoice.status} ·{" "}
              {invoice.total} {invoice.currency}
            </p>
          ))}
        </section>
      )}

      <div className={styles.actions}>
        <Link to="/notifications" className="wine-btn wine-btn--secondary">
          Back to notifications
        </Link>
      </div>
    </div>
  );
}
