import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  winePackageItemsApi,
  winePackagesApi,
  tradeApi,
} from "../services/api";
import { canManageAllPackages } from "../constants/roles";
import { useReturnToLink } from "../hooks/useReturnToLink";
import {
  badgeClass,
  itemReviewState,
  sourceLabel,
} from "../constants/winePackages";
import { formatDate, formatDateTime, deadlineLabel } from "../utils/dates";
import PackageStatusBadge from "./PackageStatusBadge";
import DetailHero from "./DetailHero";
import WinePackageItemForm from "./WinePackageItemForm";
import WinePackageForm from "./WinePackageForm";
import ReviewForm from "./ReviewForm";
import ShipmentTrackingPanel from "./ShipmentTrackingPanel";
import WinePackageBillingPanel from "./WinePackageBillingPanel";
import ImageManager from "./ImageManager";
import styles from "./winePackages.module.css";
import type {
  ReviewProgress,
  WinePackage,
  WinePackageItem,
} from "../types/winePackage";
import type { WinePackageTimelineEvent } from "../types/api";
import tradeStyles from "./trade.module.css";
import TradeMessages from "./TradeMessages";
import { useAuth } from "../contexts/AuthContext";
import { isOfflineEnabled } from "../constants/featureFlags";
import { cachePackageDetail, getCachedPackageDetail } from "../offline";
import { mayUseOfflineFallback } from "../offline/fallback";
import OfflineBadge from "./OfflineBadge";

// One wine package: what arrived, who is responsible, how the reviews are
// going, and the workflow actions available right now.
//
// Every action button comes from the `can` map the API returns, so the UI can
// never offer a move the backend would reject. Completion is shown as automatic
// or deliberate, because only automatic completions reopen by themselves.
function WinePackageDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const returnToLink = useReturnToLink();
  const { user } = useAuth();

  const [pkg, setPkg] = useState<WinePackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [reviewItemId, setReviewItemId] = useState<number | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [timeline, setTimeline] = useState<WinePackageTimelineEvent[]>([]);
  const [offlineCopy, setOfflineCopy] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  // Inline "Edit package details" (the form previously only on /edit).
  const [showEditDetails, setShowEditDetails] = useState(false);
  // Trade-chain status moves (mirrors /admin/trade/packages assessment).
  const [tradeDecision, setTradeDecision] = useState<"" | "approve" | "reject">("");
  const [tradeReason, setTradeReason] = useState("");
  const [tradeBusy, setTradeBusy] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);

  // Editorial assessment state.
  const [assessing, setAssessing] = useState(false);
  const [assessError, setAssessError] = useState<string | null>(null);
  const [assessed, setAssessed] = useState(false);
  const [packageDecision, setPackageDecision] = useState<"approve" | "reject" | "">("");
  const [packageReason, setPackageReason] = useState("");

  const load = useCallback(async () => {
    try {
      setError(null);
      const [data, activity] = await Promise.all([
        winePackagesApi.show(id),
        winePackagesApi.timeline(id),
      ]);
      setPkg(data);
      setTimeline(activity.events || []);
      setOfflineCopy(false);
      if (isOfflineEnabled() && user?.id)
        setCachedAt(await cachePackageDetail(user.id, data));
    } catch (err) {
      if (isOfflineEnabled() && user?.id && mayUseOfflineFallback(err)) {
        const cached = await getCachedPackageDetail(user.id, id);
        if (cached) {
          setPkg(cached.data);
          setCachedAt(cached.cachedAt);
          setOfflineCopy(true);
          return;
        }
      }
      setError(
        err instanceof Error ? err.message : "Failed to load wine package",
      );
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Trade submissions carry a conversation with the submitter. Editors/Admins
  // read and answer it here too (the payload is the same staff endpoint the
  // /admin/trade page uses); producer packages have no conversation.
  const canChat =
    canManageAllPackages(user) && pkg?.source === "trade_submission";

  async function handleAssess() {
    if (!pkg?.id || !packageDecision) return;
    setAssessing(true);
    setAssessError(null);
    try {
      // Build decisions: for "approve", send "approved" for all wines;
      // for "reject", send "rejected" for all wines.
      const decisions: Record<string, "approved" | "rejected"> = {};
      for (const item of pkg.items ?? []) {
        decisions[item.id.toString()] = packageDecision === "approve" ? "approved" : "rejected";
      }
      await tradeApi.assessPackage(pkg.id, {
        decisions,
        reason: packageReason.trim() || null,
      });
      setAssessed(true);
      await load();
    } catch (err) {
      setAssessError(
        err instanceof Error ? err.message : "Unable to record assessment",
      );
    } finally {
      setAssessing(false);
    }
  }

  async function runAction(
    action: () => Promise<unknown>,
    options: { confirm?: string } = {},
  ) {
    if (options.confirm && !window.confirm(options.confirm)) return;

    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "That action could not be completed",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this wine package? This cannot be undone."))
      return;
    if (!pkg) return;

    setBusy(true);
    try {
      await winePackagesApi.destroy(pkg.id);
      navigate("/wine-packages");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete wine package",
      );
      setBusy(false);
    }
  }

  async function handleRemoveItem(item: WinePackageItem) {
    if (!window.confirm(`Remove “${item.label}” from this package?`)) return;
    if (!pkg) return;

    setBusy(true);
    setError(null);
    try {
      await winePackageItemsApi.destroy(pkg.id, item.id);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove this wine line",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className={tradeStyles.page}>
        <p className="wine-management__loading">Loading wine package…</p>
      </div>
    );
  }

  if (error && !pkg) {
    return (
      <div className={tradeStyles.page}>
        <p className="wine-management__error">{error}</p>
        <Link to="/wine-packages" className="wine-btn wine-btn--primary">
          Back to Wine Packages
        </Link>
      </div>
    );
  }

  if (!pkg) return null;

  const can = offlineCopy ? {} : pkg.can || {};
  const canEdit = Boolean(can.update);
  const canManageItems = Boolean(can.manage_items);
  const canManageImages = Boolean(can.manage_attachments);
  const canCreateReview = Boolean(can.create_review);
  const producerMode = pkg.source === "producer_request" && !canCreateReview;

  // Trade submissions move through the trade chain (assess → quote → …). The
  // editorial buttons above do not apply, so surface the same assessment
  // action the trade admin queue offers, right here.
  async function runTradeAssessment() {
    if (!tradeDecision) return;
    const current = pkg;
    if (!current) return;
    const items = current.items ?? [];
    setTradeBusy(true);
    setTradeError(null);
    try {
      const decisions: Record<string, "approved" | "rejected"> = {};
      items.forEach((item) => {
        decisions[item.id.toString()] =
          tradeDecision === "approve" ? "approved" : "rejected";
      });
      await tradeApi.assessPackage(current.id, {
        decisions,
        reason: tradeReason,
      });
      setTradeDecision("");
      setTradeReason("");
      load();
    } catch (err) {
      setTradeError(
        err instanceof Error ? err.message : "Unable to record assessment",
      );
    } finally {
      setTradeBusy(false);
    }
  }

  const progress: ReviewProgress = (pkg.review_progress as
    | ReviewProgress
    | undefined) || {
    requested: 0,
    reviewed: 0,
    pending: 0,
    percent: 100,
  };

  return (
    <div className={tradeStyles.page}>
      <Link to="/wine-packages" className="wine-detail__back">
        &larr; Back to Wine Packages
      </Link>

      {error && <p className="wine-management__error">{error}</p>}
      {offlineCopy && <OfflineBadge cachedAt={cachedAt} offlineCopy />}

      <DetailHero
        className="wine-app__detail-hero--trade"
        title={pkg.producer_name || `Package #${pkg.id}`}
        actions={
          canEdit ? (
            <button
              type="button"
              className="wine-btn wine-btn--secondary wine-btn--sm"
              onClick={() => setShowEditDetails((open) => !open)}
            >
              {showEditDetails ? "Close editor" : "Edit package"}
            </button>
          ) : undefined
        }
      >
        <div className={tradeStyles.packageStatus}>
          <span className={tradeStyles.packageStatusLabel}>Status</span>
          <PackageStatusBadge status={pkg.status} />
        </div>
        <p className={tradeStyles.packageStatusHint}>
          Source: {sourceLabel(pkg.source)} · Reviewer:{" "}
          {pkg.reviewer_name || "unassigned"}
          {pkg.expected_at ? ` · Expected ${formatDate(pkg.expected_at)}` : ""}
          {pkg.arrived_at ? ` · Arrived ${formatDateTime(pkg.arrived_at)}` : ""}
          {pkg.review_deadline
            ? ` · Deadline ${formatDate(pkg.review_deadline)} · ${deadlineLabel(pkg.review_deadline)}`
            : ""}
          {pkg.reviewed_at ? ` · Reviewed ${formatDate(pkg.reviewed_at)}` : ""}
          {pkg.auto_completed ? " · Completed automatically" : ""}
          {pkg.status === "completed" && !pkg.auto_completed
            ? " · Completed deliberately"
            : ""}
        </p>
      </DetailHero>

      {showEditDetails && (
        <WinePackageForm
          packageId={pkg.id}
          embedded
          onSaved={() => {
            setShowEditDetails(false);
            load();
          }}
          onCancel={() => setShowEditDetails(false)}
        />
      )}

      {(pkg.status === "rejected" && pkg.rejection_reason) ||
      pkg.producer_reference ||
      pkg.producer_notes ||
      pkg.shipping_notes ||
      pkg.notes ? (
        <div className={tradeStyles.card}>
          <h2>Notes &amp; references</h2>
          <div className={tradeStyles.grid}>
            {pkg.status === "rejected" && pkg.rejection_reason && (
              <div className={tradeStyles.field}>
                <span className={tradeStyles.muted}>Rejection reason</span>
                <strong>{pkg.rejection_reason}</strong>
              </div>
            )}
            {pkg.producer_reference && (
              <div className={tradeStyles.field}>
                <span className={tradeStyles.muted}>Producer reference</span>
                <strong>{pkg.producer_reference}</strong>
              </div>
            )}
            {pkg.producer_notes && (
              <div className={tradeStyles.field}>
                <span className={tradeStyles.muted}>Request notes</span>
                <strong>{pkg.producer_notes}</strong>
              </div>
            )}
            {pkg.shipping_notes && (
              <div className={tradeStyles.field}>
                <span className={tradeStyles.muted}>Shipping notes</span>
                <strong>{pkg.shipping_notes}</strong>
              </div>
            )}
            {pkg.notes && (
              <div className={`${tradeStyles.field} ${tradeStyles.fieldWide}`}>
                <span className={tradeStyles.muted}>Notes</span>
                <strong>{pkg.notes}</strong>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Editorial decision — for trade submissions awaiting approval. */}
      {(pkg.status === "editorial_pending" || pkg.status === "assessment_in_progress") && (
        <div className={tradeStyles.card}>
          <h2>Editorial decision</h2>
          {assessError && (
            <div className={tradeStyles.error} role="alert">
              {assessError}
            </div>
          )}
          {assessed && (
            <div className={tradeStyles.success}>
              Package approved. The submitter is notified and can now ship wines.
            </div>
          )}
          {!assessed && (
            <div className={tradeStyles.fieldGroup}>
              <p className={tradeStyles.muted}>
                Approve this submission to start the review process, or reject it
                with a reason.
              </p>
              <div className={tradeStyles.field}>
                <label>Decision</label>
                <div className={tradeStyles.radioGroup} style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <input
                      type="radio"
                      name="package-decision"
                      value="approve"
                      checked={packageDecision === "approve"}
                      onChange={(e) => setPackageDecision(e.target.value as "approve" | "reject")}
                    />
                    <strong>Approve submission</strong>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <input
                      type="radio"
                      name="package-decision"
                      value="reject"
                      checked={packageDecision === "reject"}
                      onChange={(e) => setPackageDecision(e.target.value as "approve" | "reject")}
                    />
                    <strong>Reject submission</strong>
                  </label>
                </div>
              </div>
              <div className={tradeStyles.fieldWide}>
                <label>Reason (required for rejection)</label>
                <textarea
                  value={packageReason}
                  onChange={(e) => setPackageReason(e.target.value)}
                  placeholder="Explain the decision for the submitter…"
                  rows={3}
                />
              </div>
              <div className={tradeStyles.actions}>
                <button
                  type="button"
                  className="wine-btn wine-btn--primary"
                  disabled={assessing || !packageDecision || (packageDecision === "reject" && !packageReason.trim())}
                  onClick={handleAssess}
                >
                  {assessing ? "Processing…" : packageDecision === "approve" ? "Approve submission" : "Reject submission"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {(canManageImages ||
        (Array.isArray(pkg.images) && pkg.images.length > 0)) && (
        <div className={tradeStyles.card}>
          <h2>Package images</h2>
          {canManageImages ? (
            <ImageManager
              imageableType="wine_package"
              imageableId={pkg.id}
              images={Array.isArray(pkg.images) ? pkg.images : []}
              imageIds={Array.isArray(pkg.image_ids) ? pkg.image_ids : []}
              onImagesChange={load}
            />
          ) : (
            <div className="image-manager__thumbs">
              {(pkg.images ?? []).map((src) => (
                <a
                  key={src}
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="image-manager__thumb"
                >
                  <img src={src} alt="Package image" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={tradeStyles.card}>
        <h2>Review progress</h2>
        <div className={styles.progressRow}>
          <div
            className={styles.progressBar}
            role="progressbar"
            aria-valuenow={progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Review progress"
          >
            <div
              className={styles.progressFill}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <span>
            {progress.reviewed}/{progress.requested} reviewed (
            {progress.percent}%)
          </span>
          {progress.pending > 0 && (
            <span className={styles.overdue}>{progress.pending} pending</span>
          )}
        </div>
      </div>

      {(can.submit ||
        can.withdraw ||
        can.restore_draft ||
        can.accept ||
        can.reject ||
        can.mark_in_transit ||
        can.mark_arrived ||
        can.start_reviewing ||
        can.mark_completed ||
        can.reopen ||
        can.cancel) && (
        <div className={tradeStyles.actions}>
          {can.submit && (
            <button
              type="button"
              className="wine-btn wine-btn--primary"
              disabled={busy}
              onClick={() => runAction(() => winePackagesApi.submit(pkg.id))}
            >
              Submit Request
            </button>
          )}
          {can.withdraw && (
            <button
              type="button"
              className="wine-btn wine-btn--secondary"
              disabled={busy}
              onClick={() =>
                runAction(() => winePackagesApi.withdraw(pkg.id), {
                  confirm: "Withdraw this pending request?",
                })
              }
            >
              Withdraw Request
            </button>
          )}
          {can.restore_draft && (
            <button
              type="button"
              className="wine-btn wine-btn--secondary"
              disabled={busy}
              onClick={() =>
                runAction(() => winePackagesApi.restoreDraft(pkg.id))
              }
            >
              Restore Draft
            </button>
          )}
          {can.accept && (
            <button
              type="button"
              className="wine-btn wine-btn--secondary"
              disabled={busy}
              onClick={() => runAction(() => winePackagesApi.accept(pkg.id))}
            >
              Accept and Assign to Me
            </button>
          )}
          {can.reject && (
            <button
              type="button"
              className="wine-btn wine-btn--danger"
              disabled={busy}
              onClick={() => setShowReject((open) => !open)}
            >
              Reject request
            </button>
          )}
          {can.mark_in_transit && (
            <button
              type="button"
              className="wine-btn wine-btn--secondary"
              disabled={busy}
              onClick={() =>
                runAction(() => winePackagesApi.markInTransit(pkg.id))
              }
            >
              Mark in transit
            </button>
          )}
          {can.mark_arrived && (
            <button
              type="button"
              className="wine-btn wine-btn--secondary"
              disabled={busy}
              onClick={() =>
                runAction(() => winePackagesApi.markArrived(pkg.id), {
                  confirm: "Confirm these wines have physically arrived?",
                })
              }
            >
              Mark arrived
            </button>
          )}
          {can.start_reviewing && (
            <button
              type="button"
              className="wine-btn wine-btn--secondary"
              disabled={busy}
              onClick={() =>
                runAction(() => winePackagesApi.startReviewing(pkg.id))
              }
            >
              Start Reviewing
            </button>
          )}
          {can.mark_completed && (
            <button
              type="button"
              className="wine-btn wine-btn--primary"
              disabled={busy}
              onClick={() =>
                runAction(() => winePackagesApi.markCompleted(pkg.id), {
                  confirm:
                    progress.pending > 0
                      ? `${progress.pending} review(s) are still outstanding. Complete this package anyway?`
                      : "",
                })
              }
            >
              Mark completed
            </button>
          )}
          {can.reopen && (
            <button
              type="button"
              className="wine-btn wine-btn--secondary"
              disabled={busy}
              onClick={() => runAction(() => winePackagesApi.reopen(pkg.id))}
            >
              Reopen
            </button>
          )}
          {can.cancel && (
            <button
              type="button"
              className="wine-btn wine-btn--danger"
              disabled={busy}
              onClick={() =>
                runAction(() => winePackagesApi.cancel(pkg.id), {
                  confirm: "Cancel this package?",
                })
              }
            >
              Cancel package
            </button>
          )}
        </div>
      )}

      {showReject && (
        <form
          className={styles.inlineForm}
          onSubmit={(event) => {
            event.preventDefault();
            setShowReject(false);
            runAction(() => winePackagesApi.reject(pkg.id, rejectionReason));
          }}
        >
          <div className={styles.filterField} style={{ flex: "1 1 20rem" }}>
            <label htmlFor="rejection-reason">Reason for rejecting</label>
            <input
              id="rejection-reason"
              type="text"
              required
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
            />
          </div>
          <div className={styles.inlineFormActions}>
            <button
              type="submit"
              className="wine-btn wine-btn--primary wine-btn--lg"
              disabled={busy}
            >
              Reject package
            </button>
            <button
              type="button"
              className="wine-btn wine-btn--secondary"
              onClick={() => setShowReject(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Trade submissions move through the trade chain, not the editorial
          buttons above — offer the same assessment action the trade admin
          queue uses, so status can be changed from this page too. */}
      {pkg.source === "trade_submission" &&
        canManageAllPackages(user) &&
        (pkg.status === "editorial_pending" ||
          pkg.status === "partially_approved") && (
        <div className={tradeStyles.card}>
          <h2>Editorial assessment</h2>
          <p className={tradeStyles.muted}>
            Apply the Wine Words decision for this submission — identical to the
            trade admin queue.
          </p>
          {tradeError && <div className={styles.error}>{tradeError}</div>}
          <div
            className={tradeStyles.actions}
            style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}
          >
            <label className={styles.checkboxField}>
              <input
                type="radio"
                name={`trade-decision-${pkg.id}`}
                checked={tradeDecision === "approve"}
                onChange={() => setTradeDecision("approve")}
              />
              Approve submission (all wines approved)
            </label>
            <label className={styles.checkboxField}>
              <input
                type="radio"
                name={`trade-decision-${pkg.id}`}
                checked={tradeDecision === "reject"}
                onChange={() => setTradeDecision("reject")}
              />
              Reject submission
            </label>
            {tradeDecision === "reject" && (
              <textarea
                rows={3}
                placeholder="Reason (required for rejection)"
                value={tradeReason}
                onChange={(event) => setTradeReason(event.target.value)}
              />
            )}
            <div>
              <button
                type="button"
                className="wine-btn wine-btn--primary"
                disabled={
                  tradeBusy ||
                  !tradeDecision ||
                  (tradeDecision === "reject" && !tradeReason.trim())
                }
                onClick={runTradeAssessment}
              >
                {tradeBusy
                  ? "Processing…"
                  : tradeDecision === "approve"
                    ? "Approve submission"
                    : "Reject submission"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={tradeStyles.card}>
        <h2>Wines in this package</h2>

        {(pkg.items?.length ?? 0) > 0 ? (
          <div className={tradeStyles.table}>
            <table className={tradeStyles.table}>
              <thead>
                <tr>
                  <th scope="col">Wine</th>
                  <th scope="col">Bottles</th>
                  <th scope="col">Condition</th>
                  <th scope="col">Review</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(pkg.items ?? []).map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.wine_slug ? (
                        <Link to={`/wines/${item.wine_slug}`}>
                          {item.label}
                        </Link>
                      ) : (
                        <span>{item.label}</span>
                      )}
                      {item.notes && (
                        <div className={tradeStyles.muted}>{item.notes}</div>
                      )}
                    </td>
                    <td>{item.quantity}</td>
                    <td className={tradeStyles.muted}>
                      {item.condition || "—"}
                    </td>
                    <td>
                      <span className={badgeClass(itemReviewState(item).tone)}>
                        {itemReviewState(item).label}
                      </span>
                      {item.review_slug && (
                        <div>
                          <Link
                            to={returnToLink(`/reviews/${item.review_slug}`)}
                            className="wine-link"
                          >
                            View review
                          </Link>
                        </div>
                      )}
                    </td>
                    <td>
                      {(canManageItems || canCreateReview) && (
                        <div className={styles.rowActions}>
                          {canCreateReview &&
                            item.reviewable &&
                            !item.review_id && (
                              <button
                                type="button"
                                className="wine-btn wine-btn--primary wine-btn--sm"
                                onClick={() =>
                                  setReviewItemId(
                                    reviewItemId === item.id ? null : item.id,
                                  )
                                }
                              >
                                Create review
                              </button>
                            )}
                          {canManageItems && (
                            <button
                              type="button"
                              className="wine-btn wine-btn--ghost wine-btn--sm"
                              onClick={() =>
                                setEditingItem(
                                  editingItem === item.id ? null : item.id,
                                )
                              }
                            >
                              Edit
                            </button>
                          )}
                          {canManageItems && (
                            <button
                              type="button"
                              className="wine-btn wine-btn--danger"
                              disabled={busy}
                              onClick={() => handleRemoveItem(item)}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={tradeStyles.muted}>
            No wines recorded yet. Add the bottles that came in this package.
          </p>
        )}

        {canManageItems && (
          <>
            {editingItem != null &&
              (() => {
                const editing = pkg.items?.find(
                  (candidate) => candidate.id === editingItem,
                );
                if (!editing) return null;
                return (
                  <WinePackageItemForm
                    packageId={pkg.id}
                    item={editing}
                    packageProducerId={pkg.producer_id ?? null}
                    packageProducerName={pkg.producer_name ?? null}
                    producerMode={producerMode}
                    onSaved={() => {
                      setEditingItem(null);
                      load();
                    }}
                    onCancel={() => setEditingItem(null)}
                  />
                );
              })()}

            {canCreateReview &&
              reviewItemId != null &&
              (() => {
                const reviewItem = pkg.items?.find(
                  (candidate) => candidate.id === reviewItemId,
                );
                if (!reviewItem) return null;
                return (
                  <div className="review-form-wrapper">
                    <ReviewForm
                      wineSlug={reviewItem.wine_slug ?? undefined}
                      vintageId={reviewItem.vintage_id ?? undefined}
                      vintageYear={reviewItem.vintage_year ?? null}
                      wineName={reviewItem.wine_name ?? undefined}
                      vintageNoVintage={
                        reviewItem.vintage_no_vintage ?? undefined
                      }
                      packageId={pkg.id}
                      packageItemId={reviewItem.id}
                      onSaved={(review) => {
                        setReviewItemId(null);
                        load();
                        if (review?.slug)
                          navigate(returnToLink(`/reviews/${review.slug}`));
                      }}
                      onCancel={() => setReviewItemId(null)}
                    />
                  </div>
                );
              })()}

            {showAddItem ? (
              <WinePackageItemForm
                packageId={pkg.id}
                packageProducerId={pkg.producer_id ?? null}
                packageProducerName={pkg.producer_name ?? null}
                producerMode={producerMode}
                onSaved={() => {
                  setShowAddItem(false);
                  load();
                }}
                onCancel={() => setShowAddItem(false)}
              />
            ) : (
              <div className={styles.inlineFormActions}>
                <button
                  type="button"
                  className="wine-btn wine-btn--primary"
                  onClick={() => setShowAddItem(true)}
                >
                  + Add a wine
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <ShipmentTrackingPanel
        packageId={pkg.id}
        canManage={Boolean(can.manage_tracking)}
        canRefresh={Boolean(can.refresh_tracking)}
        producerMode={producerMode}
        onChanged={load}
      />

      {/* Billing — staff-only panel (Admin/Editor): confirm billable bottles,
          create manual invoices, download/email PDFs, record payments. */}
      {can.manage_billing && (
        <WinePackageBillingPanel packageId={pkg.id} onChanged={load} />
      )}

      {/* Conversation — trade submissions only. */}
      {canChat && (
        <TradeMessages packageId={pkg.id} mode="staff" />
      )}

      <div className={tradeStyles.card}>
        <h2>Activity</h2>
        {timeline.length === 0 ? (
          <p className={tradeStyles.muted}>No activity recorded yet.</p>
        ) : (
          <ul className={tradeStyles.muted}>
            {timeline.map((event) => (
              <li key={`${event.source}-${event.id}`}>
                {formatDateTime(event.occurred_at) || "—"} ·{" "}
                {event.description ||
                  event.message ||
                  event.status ||
                  event.event_type.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
        )}
      </div>

      {can.destroy && (
        <div className={tradeStyles.actions}>
          <button
            type="button"
            className="wine-btn wine-btn--danger"
            disabled={busy}
            onClick={handleDelete}
          >
            Delete package
          </button>
        </div>
      )}
    </div>
  );
}

export default WinePackageDetail;
