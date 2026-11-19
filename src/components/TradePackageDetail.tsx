import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { tradeApi } from "../services/api";
import type { TradePackage } from "../types/trade";
import { useAuth } from "../contexts/AuthContext";
import TradeMessages from "./TradeMessages";
import styles from "./trade.module.css";

export default function TradePackageDetail({
  guestToken,
}: {
  guestToken?: string;
}) {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const [pkg, setPkg] = useState<TradePackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One automatic "claim by email" attempt per mount (see the load effect).
  const [claimAttempted, setClaimAttempted] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        setPkg(
          guestToken
            ? await tradeApi.getGuestPackage(guestToken)
            : await tradeApi.getPackage(id || ""),
        );
      } catch (err) {
        // A submission made as a guest has no owner until it is claimed, so a
        // logged-in viewer (e.g. redirected here right after signing in from
        // the confirmation screen) gets a 404. Claim it once by the account
        // email — the backend only allows this when the submitted contact
        // email matches — and retry the load.
        if (!guestToken && isAuthenticated && !claimAttempted) {
          setClaimAttempted(true);
          try {
            setPkg(await tradeApi.claimPackage(id || ""));
            return;
          } catch {
            // Fall through and surface the original load error.
          }
        }
        setError(err instanceof Error ? err.message : "Unable to load package");
      }
    })();
  }, [id, guestToken, isAuthenticated, claimAttempted]);
  async function claim() {
    if (!guestToken) return;
    setBusy(true);
    try {
      setPkg(await tradeApi.claimGuestPackage(guestToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to claim package");
    } finally {
      setBusy(false);
    }
  }
  function packageStatusLabel(status: string) {
    return status.replaceAll("_", " ");
  }
  async function pay(invoiceId: number) {
    try {
      const result = await tradeApi.checkout(invoiceId, guestToken);
      window.location.assign(result.checkout_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start payment");
    }
  }
  if (error)
    return (
      <div className={styles.page}>
        <div className={styles.error}>{error}</div>
        <Link to="/trade/submit" className="wine-btn wine-btn--secondary">
          Submit a wine
        </Link>
      </div>
    );
  if (!pkg)
    return (
      <div className={styles.page}>
        <p>Loading package…</p>
      </div>
    );
  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1>Wine package #{pkg.id}</h1>
        <div className={styles.packageStatus}>
          <span className={styles.packageStatusLabel}>Submission status</span>
          <span
            className={`${styles.packageStatusBadge} ${pkg.status === "editorial_pending" ? styles["packageStatusBadge--editorialPending"] : ""}`}
          >
            {packageStatusLabel(pkg.status)}
          </span>
          {pkg.status === "editorial_pending" && (
            <span className={styles.packageStatusHint}>
              Wine Words is reviewing your submission.
            </span>
          )}
          {pkg.status === "assessment_in_progress" && (
            <span className={styles.packageStatusHint}>
              Our editorial team is assessing your submission.
            </span>
          )}
          {pkg.status === "partially_approved" && (
            <span className={styles.packageStatusHint}>
              Some wines were approved — others need more information or were
              declined.
            </span>
          )}
          {pkg.status === "approved" && (
            <span className={styles.packageStatusHint}>
              Your submission was approved. We&rsquo;ll be in touch about next
              steps.
            </span>
          )}
          {pkg.status === "rejected" && (
            <span className={styles.packageStatusHint}>
              Your submission was not approved. Please contact us if you have
              questions.
            </span>
          )}
        </div>
        {guestToken && pkg.claimable && isAuthenticated && (
          <button
            className={`wine-btn wine-btn--lg ${styles.heroCta}`}
            disabled={busy}
            onClick={claim}
          >
            {busy ? "Claiming…" : "Claim this package"}
          </button>
        )}
        {guestToken && pkg.claimable && !isAuthenticated && (
          <p>Sign in to claim this package to your account.</p>
        )}
      </div>
      <section className={styles.card}>
        <h2>Submitted wines</h2>
        <div className={styles.table}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Wine</th>
                <th>Vintage</th>
                <th>Status</th>
                <th>Review progress</th>
              </tr>
            </thead>
            <tbody>
              {pkg.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.wine_name}
                    {item.submitted && item.catalogue_wine_name && (
                      <div className={styles.muted}>
                        Being reviewed as <strong>{item.catalogue_wine_name}</strong>
                        {item.catalogue_producer_name
                          ? ` — ${item.catalogue_producer_name}`
                          : ""}
                        {item.vintage_label ? ` (${item.vintage_label})` : ""}
                      </div>
                    )}
                  </td>
                  <td>{item.vintage || "—"}</td>
                  <td>
                    <span className={styles.status}>{item.item_status}</span>
                  </td>
                  <td>{item.review_progress.replaceAll("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {pkg.contact_snapshot && (
        <section className={styles.card}>
          <h2>Contact</h2>
          <p>
            {pkg.contact_snapshot.company_name} ·{" "}
            {pkg.contact_snapshot.contact_name}
          </p>
          <p>
            {pkg.contact_snapshot.email} · {pkg.contact_snapshot.country}
          </p>
        </section>
      )}
      <section className={styles.card}>
        <h2>Commercial</h2>
        {pkg.quotes.length === 0 && pkg.invoices.length === 0 ? (
          <p className={styles.muted}>No quote or invoice is available yet.</p>
        ) : (
          <>
            {pkg.quotes.map((quote) => (
              <p key={quote.id}>
                Quote: {quote.status} · {quote.total} {quote.currency}
              </p>
            ))}
            {pkg.invoices.map((invoice) => (
              <div key={invoice.id}>
                <p>
                  Invoice {invoice.invoice_number}: {invoice.status} ·{" "}
                  {invoice.total} {invoice.currency}
                </p>
                {invoice.status !== "paid" && (
                  <button
                    className="wine-btn wine-btn--primary"
                    onClick={() => pay(invoice.id)}
                  >
                    Pay invoice
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </section>

      <section className={styles.card}>
        <h2>Conversation</h2>
        <TradeMessages packageId={pkg.id} guestToken={guestToken} />
      </section>
      <section className={styles.card}>
        <h2>Activity</h2>
        <div className={styles.timeline}>
          {pkg.events.map((event) => (
            <div key={event.id}>
              <strong>{event.event_type.replaceAll("_", " ")}</strong> ·{" "}
              {new Date(event.occurred_at).toLocaleString()}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function TradeGuestPackageRoute() {
  const { token } = useParams<{ token: string }>();
  return token ? <TradePackageDetail guestToken={token} /> : null;
}
