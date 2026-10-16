import LikeButton from "./LikeButton";
import CommentLink from "./comments/CommentLink";
import ContentStatusActions, {
  type ContentStatus,
} from "./ContentStatusActions";
import type { RoleUser } from "../constants/roles";
import type { Article } from "../types/article";
import { SearchHighlight } from "./search";

/** Strips HTML tags and truncates, for the plain-text excerpt on a card. */
function excerpt(text: string | null | undefined, max = 80): string {
  if (!text) return "";
  const stripped = text.replace(/<[^>]+>/g, "").trim();
  if (stripped.length <= max) return stripped;
  return stripped.slice(0, max) + "…";
}

export interface ArticleCardProps {
  article: Article;
  /** Search term to highlight in the title; omit outside search contexts. */
  query?: string;
  /** Whether to render the management (status) buttons. */
  canManage?: boolean;
  /** Whether to render the status badge. */
  canManageContent?: boolean;
  /** Opens the article — the card body is the click target. */
  onOpen: () => void;
  /** Draft / Publish / Archive transition for the card. */
  onStatusChange?: ((status: ContentStatus) => void) | undefined;
  /** Signed-in user — forwarded to ContentStatusActions (managers only). */
  user?: RoleUser | null;
  /** Disables the status buttons while a transition is in flight. */
  statusBusy?: boolean;
}

/**
 * A single article card in the grid. Mirrors the `wine-management__card`
 * markup used by the other grouped listings, so the grid/typography match.
 *
 * Shared by the Articles listing (which passes the management handlers).
 */
export default function ArticleCard({
  article,
  query = "",
  canManage = false,
  onOpen,
  onStatusChange,
  user,
  statusBusy = false,
}: ArticleCardProps) {
  const image =
    article.primary_image ??
    (Array.isArray(article.images) && article.images.length > 0
      ? article.images[0]
      : null);

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
      {image && (
        <img
          src={image}
          alt={article.title}
          className="wine-management__content-thumb"
        />
      )}
      <div className="wine-management__card-header">
        <h3>
          <SearchHighlight text={article.title} query={query} />
        </h3>
      </div>
      {Array.isArray(article.tags) && article.tags.length > 0 && (
        <p className="wine-management__vintage-count">
          Tags: {article.tags.join(", ")}
        </p>
      )}
      {excerpt(article.abstract || article.body) && (
        <p className="wine-management__card-excerpt">
          {excerpt(article.abstract || article.body)}
        </p>
      )}
      <div
        className="wine-management__card-meta"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="wine-management__region">
          by {article.author_name}
        </span>
        <span className="wine-management__card-meta-actions">
          <LikeButton
            kind="article"
            identifier={article.slug || article.id}
            initialLiked={article.liked_by_current_user}
            initialCount={article.likes_count}
          />
          <CommentLink kind="article" identifier={article.slug || article.id} />
        </span>
      </div>
      {canManage && onStatusChange && (
        <div
          className="wine-management__card-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <ContentStatusActions
            status={article.status}
            user={user ?? null}
            busy={statusBusy}
            onChange={onStatusChange}
          />
        </div>
      )}
    </div>
  );
}
