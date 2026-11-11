import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, MouseEvent } from "react";
import { reviewsApi, categoriesApi } from "../services/api";
import { errorMessage } from "../utils/errors";
import type { Review } from "../types/review";
import type { User } from "../types/authentication";
import ScoreBadge from "./ScoreBadge";

interface LinkReviewDialogProps {
  entityId: number
  entityName?: string | null | undefined
  /** Ids *and* slugs already attached, shown with a "Linked" badge. */
  excludeIds?: Array<number | string> | undefined
  onLinked?: ((review: Review) => void) | undefined
  onClose?: (() => void) | undefined
  /** Current authenticated user (for score visibility logic). */
  currentUser?: User | null | undefined
}

function LinkReviewDialog({
  entityId,
  entityName,
  excludeIds,
  onLinked,
  onClose,
  currentUser,
}: LinkReviewDialogProps) {
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<Review[] | null>(null);
  const [linking, setLinking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await reviewsApi.all({ query: q, per_page: 8 });
        const items = Array.isArray(data) ? data : data?.items || [];
        if (!cancelled) setResults(items.slice(0, 8));
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  async function handleLink(review: Review) {
    setLinking(true);
    setError(null);
    try {
      await categoriesApi.linkReview(entityId, review.slug || review.id);
      onLinked?.(review);
    } catch (err) {
      setError(errorMessage(err, "Failed to link review"));
      setLinking(false);
    }
  }

  function handleBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose?.();
  }

  return (
    <div className="dialog-backdrop" onClick={handleBackdropClick} role="presentation">
      <div className="dialog" role="dialog" aria-modal="true" aria-label={`Link a review to ${entityName}`}>
        <div className="dialog__header">
          <h3 className="dialog__title">Link a Review</h3>
          <button type="button" className="dialog__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="dialog__subtitle">
          Search reviews by title or wine name to add them to <strong>{entityName}</strong>.
        </p>
        <input
          ref={inputRef}
          type="text"
          className="dialog__search-input"
          placeholder="Search reviews by title or wine…"
          value={query}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
        />
        {error && <p className="dialog__error">{error}</p>}
        <div className="dialog__results">
          {results === null ? (
            <p className="dialog__hint">Type at least 2 characters to search.</p>
          ) : results.length === 0 ? (
            <p className="dialog__hint">No reviews found.</p>
          ) : (
            <ul className="dialog__results-list">
              {results.map((review: Review) => {
                const isLinked = (excludeIds || []).includes(review.id)
                  || (excludeIds || []).includes(review.slug);
                return (
                  <li key={review.id || review.slug} className="dialog__result-item">
                    <div className="dialog__result-info">
                      <strong className="dialog__result-name">{review.title}</strong>
                      {review.wine_name && (
                        <span className="dialog__result-meta">
                          {review.wine_name}
                          {review.vintage_year ? ` ${review.vintage_year}` : ""}
                        </span>
                      )}
                      {review.score != null && (
                        <ScoreBadge score={review.score} className="dialog__score-badge" user={currentUser} />
                      )}
                    </div>
                    {isLinked ? (
                      <span className="dialog__linked-badge">Linked</span>
                    ) : (
                      <button
                        type="button"
                        className="dialog__link-btn"
                        disabled={linking}
                        onClick={() => handleLink(review)}
                      >
                        {linking ? "Linking…" : "Link"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default LinkReviewDialog;