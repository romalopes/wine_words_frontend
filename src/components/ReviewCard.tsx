import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import LikeButton from "./LikeButton";
import CommentLink from "./comments/CommentLink";
import ContentStatusActions, {
  type ContentStatus,
} from "./ContentStatusActions";
import DeadlineBadge from "./DeadlineBadge";
import type { RoleUser } from "../constants/roles";
import type { Review } from "../types/review";
import { SearchHighlight } from "./search";
import { reviewImage } from "../utils/wineImages";

/** Strips HTML tags and truncates, for the plain-text excerpt on a card. */
function excerpt(html: string | null | undefined, max = 50) {
  if (!html) return "";
  const stripped = html.replace(/<[^>]+>/g, "").trim();
  if (stripped.length <= max) return stripped;
  return stripped.slice(0, max) + "…";
}

export interface ReviewCardProps {
  review: Review;
  /** Search term to highlight in the title; omit outside search contexts. */
  query?: string;
  /** Whether to render the management (Edit / status / Delete) buttons. */
  canManage?: boolean;
  /** Opens the review — the card body is the click target. */
  onOpen: () => void;
  onEdit?: (() => void) | undefined;
  /** Draft / Publish / Archive transition for the card. */
  onStatusChange?: ((status: ContentStatus) => void) | undefined;
  /** Signed-in user — forwarded to ContentStatusActions (managers only). */
  user?: RoleUser | null;
  /** Disables the status buttons while a transition is in flight. */
  statusBusy?: boolean;
  onDelete?: (() => void) | undefined;
  /** Rendered inside the card, used for the inline edit form. */
  children?: ReactNode;
}

/**
 * A single review card in the category grid. Mirrors the `wine-management__card`
 * markup used by the other grouped listings, so the grid/typography match.
 *
 * Shared by the Reviews listing (which passes the management handlers) and the
 * article detail page (read-only: it just navigates to the review).
 */
export default function ReviewCard({
  review,
  query = "",
  canManage = false,
  onOpen,
  onEdit,
  onStatusChange,
  user,
  statusBusy = false,
  onDelete,
  children,
}: ReviewCardProps) {
  const image = reviewImage(review.images, review.wine_image, review.primary_image);

  return (
    <div
      className="wine-management__card"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <img
        src={image}
        alt={review.title || review.wine_name || "review"}
        className="wine-management__thumb"
      />
      <div className="wine-management__card-header">
        <h3>
          <SearchHighlight
            text={review.title || "Untitled review"}
            query={query}
          />
        </h3>
        {review.score != null && (
          <span
            className={`wine-management__color-badge wine-management__color-badge--${review.status}`}
          >
            {review.score}
          </span>
        )}
      </div>
      {(review.wine_name || review.vintage_year) && (
        <p className="wine-management__region">
          {review.wine_slug ? (
            <Link
              to={`/wines/${review.wine_slug}`}
              className="my-reviews__wine-link"
              onClick={(e) => e.stopPropagation()}
            >
              {review.wine_name || "Unknown wine"}
              {review.vintage_year ? ` (${review.vintage_year})` : ""}
            </Link>
          ) : (
            <>
              {review.wine_name}
              {review.vintage_year ? ` (${review.vintage_year})` : ""}
            </>
          )}
        </p>
      )}
      {excerpt(review.comment) && (
        <p className="wine-management__card-excerpt">
          {excerpt(review.comment)}
        </p>
      )}
      {/* Issue #185: drafts only. The badge renders nothing for published or
          archived content, and it prefers the API's overdue / day count so
          the card can never disagree with the server. */}
      <DeadlineBadge
        deadline={review.deadline}
        status={review.status}
        overdue={review.overdue}
        daysUntilDeadline={review.days_until_deadline}
      />

      <div
        className="wine-management__card-meta"
        onClick={(e) => e.stopPropagation()}
      >
        {review.reviewer_name && (
          <span className="wine-management__region">
            by {review.reviewer_name}
          </span>
        )}
        <span className="wine-management__card-meta-actions">
          <LikeButton
            kind="review"
            identifier={review.slug || review.id}
            initialLiked={review.liked_by_current_user}
            initialCount={review.likes_count}
          />
          <CommentLink kind="review" identifier={review.slug || review.id} />
        </span>
      </div>
      {canManage && (onEdit ?? onStatusChange ?? onDelete) && (
        <div
          className="wine-management__card-actions"
          onClick={(e) => e.stopPropagation()}
        >
          {onStatusChange && (
            <ContentStatusActions
              status={review.status}
              user={user ?? null}
              busy={statusBusy}
              onChange={onStatusChange}
            />
          )}
        </div>
      )}
      {children}
    </div>
  );
}
