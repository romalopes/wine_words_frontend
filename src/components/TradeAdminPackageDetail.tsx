import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { tradeApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { canManageAllPackages } from "../constants/roles";
import PackageStatusBadge from "./PackageStatusBadge";
import DetailHero from "./DetailHero";
import TradeMessages from "./TradeMessages";
import { formatDateTime } from "../utils/dates";
import type { TradePackage } from "../types/trade";
import styles from "./trade.module.css";

// Staff view of one trade submission (IDENTITY_206 Phase 7).
//
// Editors and Admins land here from the in-app notification / email created by
// Trade::Submissions::NotifyStaff: the public submitter's contact details, the
// wines they proposed, the full timeline (shared + internal events) and the
// conversation with the submitter. The endpoint behind it
// (/api/v1/admin/trade/packages/:id) is role-guarded server-side; this page
// only mirrors that check so the SPA can explain itself.
export default function TradeAdminPackageDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const allowed = canManageAllPackages(user);
  const [pkg, setPkg] = useState<TradePackage | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Package-level editorial assessment state.
  const [assessing, setAssessing] = useState(false);
  const [assessError, setAssessError] = useState<string | null>(null);
  const [assessed, setAssessed] = useState(false);
  const [packageDecision, setPackageDecision] = useState<
    "approve" | "reject" | ""
  >("");
  const [packageReason, setPackageReason] = useState("");

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

  async function handleAssess() {
    if (!id || !packageDecision) return;
    setAssessing(true);
    setAssessError(null);
    try {
      // Build decisions: for "approve", send "approved" for all wines;
      // for "reject", send "rejected" for all wines.
      const decisions: Record<string, "approved" | "rejected"> = {};
      for (const item of pkg.items) {
        decisions[item.id.toString()] =
          packageDecision === "approve" ? "approved" : "rejected";
      }
      await tradeApi.assessPackage(id, {
        decisions,
        reason: packageReason.trim() || null,
      });
      setAssessed(true);
      // Refresh the package so the new status and timeline events are shown.
      setPkg(await tradeApi.getStaffPackage(id));
    } catch (err) {
      setAssessError(
        err instanceof Error ? err.message : "Unable to record assessment",
      );
    } finally {
      setAssessing(false);
    }
  }

  if (!allowed) {
    return (
      <div className={styles.page}>
        <DetailHero
          className="wine-app__detail-hero--trade"
          title="Trade submission #{pkg?.id || id}"
          intro="This page is restricted to Editor and Admin accounts."
        />
        <div className={styles.actions}>
          <Link
            to="/admin/trade/packages"
            className="wine-btn wine-btn--secondary"
          >
            Back to list
          </Link>
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
      <DetailHero
        className="wine-app__detail-hero--trade"
        title={`Trade submission #${pkg.id}`}
      >
        <div className={styles.packageStatus}>
          <span className={styles.packageStatusLabel}>Status</span>
          <PackageStatusBadge status={pkg.status} />
          {pkg.submitted_at && (
            <span className={styles.packageStatusHint}>
              Submitted {formatDateTime(pkg.submitted_at)}
            </span>
          )}
        </div>
      </DetailHero>

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
                  <td>
                    {item.wine_name}
                    {/* Only reconcile when there was an original submission;
                        lines the team added from the catalogue have no
                        snapshot to match against. */}
                    {item.submitted && item.catalogue_wine_name && (
                      <div className={styles.muted}>
                        Matched to <strong>{item.catalogue_wine_name}</strong>
                        {item.catalogue_producer_name
                          ? ` — ${item.catalogue_producer_name}`
                          : ""}
                        {item.vintage_label ? ` (${item.vintage_label})` : ""}
                      </div>
                    )}
                  </td>
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

      {/* Editorial assessment — shown while the submission is awaiting review. */}
      {pkg.status === "editorial_pending" && (
        <section className={styles.card}>
          <h2>Editorial decision</h2>
          {assessError && (
            <div className={styles.error} role="alert">
              {assessError}
            </div>
          )}
          {assessed && (
            <div className={styles.success}>
              Package approved. The submitter is notified and can now ship
              wines.
              <br />
              <Link
                to={`/wine-packages/${pkg.id}`}
                className="wine-btn wine-btn--secondary"
                style={{ marginTop: "0.5rem", display: "inline-block" }}
              >
                Manage package →
              </Link>
            </div>
          )}
          {!assessed && (
            <>
              <p className={styles.muted}>
                Approve this submission to start the review process, or reject
                it with a reason.
              </p>
              <div className={styles.field}>
                <label>Decision</label>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <input
                      type="radio"
                      name="package-decision"
                      value="approve"
                      checked={packageDecision === "approve"}
                      onChange={(e) =>
                        setPackageDecision(
                          e.target.value as "approve" | "reject",
                        )
                      }
                    />
                    <strong>Approve submission</strong>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <input
                      type="radio"
                      name="package-decision"
                      value="reject"
                      checked={packageDecision === "reject"}
                      onChange={(e) =>
                        setPackageDecision(
                          e.target.value as "approve" | "reject",
                        )
                      }
                    />
                    <strong>Reject submission</strong>
                  </label>
                </div>
              </div>
              <div className={styles.fieldWide}>
                <label>Reason (required for rejection)</label>
                <textarea
                  value={packageReason}
                  onChange={(e) => setPackageReason(e.target.value)}
                  placeholder="Explain the decision for the submitter…"
                  rows={3}
                />
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className="wine-btn wine-btn--primary"
                  disabled={
                    assessing ||
                    !packageDecision ||
                    (packageDecision === "reject" && !packageReason.trim())
                  }
                  onClick={handleAssess}
                >
                  {assessing
                    ? "Processing…"
                    : packageDecision === "approve"
                      ? "Approve submission"
                      : "Reject submission"}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* Conversation — staff view (mode="staff"). */}
      <TradeMessages packageId={pkg.id} mode="staff" />

      {pkg.status === "approved" && (
        <div className={styles.success}>
          <p>
            Submission approved —{" "}
            <Link to={`/wine-packages/${pkg.id}`}>manage the package</Link> to
            add wines, record receipts, assign reviewers, and ship.
          </p>
        </div>
      )}

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

      <div className={styles.actions}>
        <Link
          to="/admin/trade/packages"
          className="wine-btn wine-btn--secondary"
        >
          Back to list
        </Link>
        <Link to="/notifications" className="wine-btn wine-btn--secondary">
          Back to notifications
        </Link>
      </div>
    </div>
  );
}
