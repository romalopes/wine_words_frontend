import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { winePackageItemsApi, winePackagesApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { canManageAllPackages } from "../constants/roles";
import { useReturnToLink } from "../hooks/useReturnToLink";
import {
  badgeClass,
  itemReviewState,
  sourceLabel,
} from "../constants/winePackages";
import { formatDate, formatDateTime, deadlineLabel } from "../utils/dates";
import PackageStatusBadge from "./PackageStatusBadge";
import WinePackageItemForm from "./WinePackageItemForm";
import ReviewForm from "./ReviewForm";
import ShipmentTrackingPanel from "./ShipmentTrackingPanel";
import ImageManager from "./ImageManager";
import styles from "./winePackages.module.css";
import type {
  ReviewProgress,
  WinePackage,
  WinePackageItem,
} from "../types/winePackage";

// One wine package: what arrived, who is responsible, how the reviews are
// going, and the workflow actions available right now.
//
// Every action button comes from the `can` map the API returns, so the UI can
// never offer a move the backend would reject. Completion is shown as automatic
// or deliberate, because only automatic completions reopen by themselves.
function WinePackageDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const returnToLink = useReturnToLink();

  const [pkg, setPkg] = useState<WinePackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [reviewItemId, setReviewItemId] = useState<number | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await winePackagesApi.show(id);
      setPkg(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load wine package",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Mirrors the backend's ownership rule: catalogue managers (Admin/Editor)
  // manage everything; a Reviewer only manages their own packages.
  const canManage = Boolean(
    pkg &&
    (canManageAllPackages(user) ||
      Number(pkg.reviewer_id) === Number(user?.id)),
  );

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
      <div className="wine-app">
        <p className="wine-management__loading">Loading wine package…</p>
      </div>
    );
  }

  if (error && !pkg) {
    return (
      <div className="wine-app">
        <p className="wine-management__error">{error}</p>
        <Link to="/wine-packages" className="wine-btn wine-btn--primary">
          Back to Wine Packages
        </Link>
      </div>
    );
  }

  if (!pkg) return null;

  const progress: ReviewProgress = (pkg.review_progress as ReviewProgress | undefined) || {
    requested: 0,
    reviewed: 0,
    pending: 0,
    percent: 100,
  };

  return (
    <div className="wine-app">
      <Link to="/wine-packages" className="wine-detail__back">
        &larr; Back to Wine Packages
      </Link>

      {error && <p className="wine-management__error">{error}</p>}

      <div className={styles.detailHeader}>
        <h1>{pkg.producer_name || `Package #${pkg.id}`}</h1>
        <PackageStatusBadge status={pkg.status} />
        {canManage && (
          <Link
            to={`/wine-packages/${pkg.id}/edit`}
            className="wine-btn wine-btn--secondary wine-btn--sm"
          >
            Edit package
          </Link>
        )}
      </div>

      <p className={styles.meta}>
        <span>Source: {sourceLabel(pkg.source)}</span>
        <span>Reviewer: {pkg.reviewer_name || "unassigned"}</span>
        {pkg.expected_at && <span>Expected {formatDate(pkg.expected_at)}</span>}
        {pkg.arrived_at && (
          <span>Arrived {formatDateTime(pkg.arrived_at)}</span>
        )}
        {pkg.review_deadline && (
          <span className={pkg.overdue ? styles.overdue : undefined}>
            Deadline {formatDate(pkg.review_deadline)} ·{" "}
            {deadlineLabel(pkg.review_deadline)}
          </span>
        )}
        {pkg.reviewed_at && <span>Reviewed {formatDate(pkg.reviewed_at)}</span>}
        {pkg.auto_completed && <span>Completed automatically</span>}
        {pkg.status === "completed" && !pkg.auto_completed && (
          <span>Completed deliberately</span>
        )}
      </p>

      {pkg.status === "rejected" && pkg.rejection_reason && (
        <p className={styles.cellMuted}>Rejected: {pkg.rejection_reason}</p>
      )}

      {pkg.notes && <p className={styles.cellMuted}>{pkg.notes}</p>}

      {(canManage || (Array.isArray(pkg.images) && pkg.images.length > 0)) && (
        <div className={styles.section}>
          <h2>Package images</h2>
          {canManage ? (
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

      <div className={styles.section}>
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

      {canManage && (
        <div className={styles.actions}>
          {pkg.can?.accept && (
            <button
              type="button"
              className="wine-btn wine-btn--secondary"
              disabled={busy}
              onClick={() => runAction(() => winePackagesApi.accept(pkg.id))}
            >
              Accept request
            </button>
          )}
          {pkg.can?.reject && (
            <button
              type="button"
              className="wine-btn wine-btn--danger"
              disabled={busy}
              onClick={() => setShowReject((open) => !open)}
            >
              Reject request
            </button>
          )}
          {pkg.can?.mark_in_transit && (
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
          {pkg.can?.mark_arrived && (
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
          {pkg.can?.mark_completed && (
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
          {pkg.can?.reopen && (
            <button
              type="button"
              className="wine-btn wine-btn--secondary"
              disabled={busy}
              onClick={() => runAction(() => winePackagesApi.reopen(pkg.id))}
            >
              Reopen
            </button>
          )}
          {pkg.can?.cancel && (
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

      <div className={styles.section}>
        <h2>Wines in this package</h2>

        {(pkg.items?.length ?? 0) > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
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
                        <div className={styles.cellMuted}>{item.notes}</div>
                      )}
                    </td>
                    <td>{item.quantity}</td>
                    <td className={styles.cellMuted}>
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
                      {canManage && (
                        <div className={styles.rowActions}>
                          {item.reviewable && !item.review_id && (
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
                          <button
                            type="button"
                            className="wine-btn wine-btn--danger"
                            disabled={busy}
                            onClick={() => handleRemoveItem(item)}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.cellMuted}>
            No wines recorded yet. Add the bottles that came in this package.
          </p>
        )}

        {canManage && (
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
                    producerId={pkg.producer_id ?? null}
                    producerName={pkg.producer_name ?? null}
                    onSaved={() => {
                      setEditingItem(null);
                      load();
                    }}
                    onCancel={() => setEditingItem(null)}
                  />
                );
              })()}

            {reviewItemId != null &&
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
                producerId={pkg.producer_id ?? null}
                producerName={pkg.producer_name ?? null}
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
        canManage={canManage}
        onChanged={load}
      />

      {canManage && (
        <div className={styles.actions}>
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
