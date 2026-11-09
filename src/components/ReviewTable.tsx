import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { canManageWinesRole } from "../constants/roles";
import LinkReviewDialog from "./LinkReviewDialog";
import ContentStatusActions from "./ContentStatusActions";
import type { ContentStatus } from "./ContentStatusActions";
import LikeButton from "./LikeButton";
import CommentLink from "./comments/CommentLink";
import { useReturnToLink } from "../hooks/useReturnToLink";
import type { Review } from "../types/review";

/**
 * The entity a review is linked to. Reviews can only be attached to a
 * category — `linkReview` exists on `categoriesApi` alone — so `type` is
 * pinned to "category" rather than widened to `LinkEntityType`. Widening it
 * would let a call site pass e.g. "grape" and have it silently ignored.
 */
export interface ReviewLinkContext {
  type: "category";
  id: number;
  name?: string | null;
}

interface ReviewTableProps {
  reviews: Review[];
  /** When set, management users get a "+ Link a Review" action. */
  linkContext?: ReviewLinkContext | undefined;
  onReviewLinked?: (() => void) | undefined;
  /** Management columns. Opt-in so read-only call sites stay unchanged. */
  canManage?: boolean;
  user?: any;
  onStatusChange?:
    | ((review: Review, status: ContentStatus) => void)
    | undefined;
  statusBusy?: boolean;
  onEdit?: ((review: Review) => void) | undefined;
  onDelete?: ((id: number) => void) | undefined;
}

/**
 * One entry per physical column, in render order.
 */
const BASE_COLUMNS = [
  "Image",
  "Score",
  "Title / wine",
  "Grapes",
  "Regions",
  "Content",
  "Follow",
  "Comment",
];

// Shared table of reviews (one review per row): Score, Wine, Vintage,
// Reviewer and Status. Rows navigate to the review detail page.
// When `linkContext` is provided, shows a "+ Link a Review" button that opens
// a dialog to search and link reviews to the given entity.
// When `canManage` is set, an Actions column carries the same Draft/Publish/
// Archive control as the card, plus Edit and Delete.
function ReviewTable({
  reviews,
  linkContext,
  onReviewLinked,
  canManage = false,
  user,
  onStatusChange,
  statusBusy = false,
  onEdit,
  onDelete,
}: ReviewTableProps) {
  const { user: currentUser } = useAuth();
  const canManageTable = canManage || canManageWinesRole(user);
  const navigate = useNavigate();
  const returnToLink = useReturnToLink();
  const [dialogOpen, setDialogOpen] = useState(false);
  const excludeIds = Array.isArray(reviews)
    ? reviews.flatMap(
        (r) => [r.id, r.slug].filter(Boolean) as (number | string)[],
      )
    : [];

  const linkButton = canManageTable && linkContext && (
    <div style={{ margin: "0 0 1rem" }}>
      <button
        type="button"
        className="btn-action"
        onClick={() => setDialogOpen(true)}
      >
        + Link a Review
      </button>
    </div>
  );

  // The "+ Link a Review" affordance stays role-gated (unchanged behaviour),
  // but the Actions column is strictly opt-in: a read-only listing such as the
  // dashboard must not grow an empty column just because the viewer manages
  // content.
  const showActions = canManageTable === true;
  const columns = showActions
    ? [...BASE_COLUMNS, "Actions"]
    : BASE_COLUMNS;

  if (!Array.isArray(reviews) || reviews.length === 0) {
    return (
      <>
        {linkButton}
        <p className="wine-management__empty-state">No reviews yet.</p>
        {linkContext && dialogOpen && (
          <LinkReviewDialog
            entityId={linkContext.id}
            entityName={linkContext.name}
            excludeIds={excludeIds}
            onClose={() => setDialogOpen(false)}
            onLinked={() => {
              setDialogOpen(false);
              onReviewLinked?.();
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      {linkButton}
      <table className="grapes-table producers-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className={
                  column === "Image" ? "producers-table__image-col" : undefined
                }
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reviews.map((review, index) => (
            <tr
              key={review.slug || review.id}
              className={
                index % 2 === 0 ? "grapes-row--even" : "grapes-row--odd"
              }
              onClick={() => navigate(returnToLink(`/reviews/${review.slug}`))}
              style={{ cursor: "pointer" }}
            >
              <td>
                {review.primary_image ||
                review.images?.[0] ||
                review.wine_image ? (
                  <img
                    src={
                      review.primary_image ||
                      review.images?.[0] ||
                      review.wine_image ||
                      undefined
                    }
                    alt={review.title}
                    className="producers-table__thumb"
                  />
                ) : (
                  <span
                    className="producers-table__thumb producers-table__thumb--empty"
                    aria-hidden="true"
                  />
                )}
              </td>
              <td>
                <strong>{review.score ?? "—"}</strong>
              </td>
              <td>
                <div>
                  <Link
                    to={returnToLink(`/reviews/${review.slug}`)}
                    className="grapes-table__link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {review.title}
                  </Link>
                  {review.wine_name && review.wine_slug && (
                    <span className="content-management__subtext">
                      <Link
                        to={returnToLink(`/wines/${review.wine_slug}`)}
                        className="content-management__subtext"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {review.wine_name}
                      </Link>
                      {review.vintage_year ? ` · ${review.vintage_year}` : ""}
                    </span>
                  )}
                  {review.wine_name && !review.wine_slug && (
                    <span className="content-management__subtext">
                      {review.wine_name}
                      {review.vintage_year ? ` · ${review.vintage_year}` : ""}
                    </span>
                  )}
                </div>
              </td>
              <td>
                {review.grapes?.map((grape, i) => (
                  <span key={`${grape.slug}-${i}`}>
                    {i > 0 && ", "}
                    <Link
                      to={`/grapes/${grape.slug}`}
                      className="content-management__subtext"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {grape.name}
                    </Link>
                  </span>
                )) || "—"}
              </td>
              <td>
                {review.regions?.map((region, i) => (
                  <span key={`${region.slug}-${i}`}>
                    {i > 0 && ", "}
                    <Link
                      to={`/regions/${region.slug}`}
                      className="content-management__subtext"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {region.name}
                    </Link>
                  </span>
                )) || "—"}
              </td>
              <td>
                {review.comment
                  ? review.comment.slice(0, 70) + (review.comment.length > 70 ? "…" : "")
                  : "—"}
              </td>
              <td>
                <LikeButton
                  kind="review"
                  identifier={review.slug}
                  initialLiked={review.liked_by_current_user}
                  initialCount={review.likes_count}
                />
              </td>
              <td>
                <CommentLink
                  kind="review"
                  identifier={review.slug}
                />
              </td>
              {showActions && (
                <td className="actions" onClick={(e) => e.stopPropagation()}>
                  {onStatusChange && (
                    <ContentStatusActions
                      status={review.status}
                      user={user ?? currentUser ?? null}
                      busy={statusBusy}
                      onChange={(status) => onStatusChange(review, status)}
                    />
                  )}
                  {onEdit && (
                    <button
                      type="button"
                      className="btn-action"
                      onClick={() => onEdit(review)}
                    >
                      Edit
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      className="btn-action btn-action--delete"
                      onClick={() => onDelete(review.id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {linkContext && dialogOpen && (
        <LinkReviewDialog
          entityId={linkContext.id}
          entityName={linkContext.name}
          excludeIds={excludeIds}
          onClose={() => setDialogOpen(false)}
          onLinked={() => {
            setDialogOpen(false);
            onReviewLinked?.();
          }}
        />
      )}
    </>
  );
}

export default ReviewTable;
