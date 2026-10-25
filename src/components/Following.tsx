import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { followsApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import NotificationPreferences from "./NotificationPreferences";
import type { Follow, FollowableType } from "../types/follow";

const TYPE_FILTERS: Array<{ label: string; value: FollowableType | null }> = [
  { label: "All", value: null },
  { label: "Producers", value: "Producer" },
  { label: "Wines", value: "Wine" },
  { label: "Reviews", value: "Review" },
  { label: "Articles", value: "Article" },
];

const PER_PAGE = 20;

/**
 * "Following" page: every Producer / Wine / Review / Article the signed-in
 * user follows, with type filters, pagination and unfollow (issue #192).
 */
export default function Following() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [filter, setFilter] = useState<FollowableType | null>(null);
  const [items, setItems] = useState<Follow[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextFilter: FollowableType | null, nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await followsApi.list({
        page: nextPage,
        per_page: PER_PAGE,
        ...(nextFilter ? { type: nextFilter } : {}),
      });
      setItems(result.items);
      setTotalCount(result.total_count);
      setTotalPages(result.total_pages);
      setPage(nextPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load follows");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    void load(filter, 1);
  }, [filter, isAuthenticated, load]);

  if (authLoading) {
    return <p className="following-page__status">Loading…</p>;
  }

  if (!isAuthenticated) {
    return (
      <div className="following-page">
        <h1>Following</h1>
        <p className="following-page__status">
          <Link to="/login">Sign in</Link> to follow producers, wines, reviews and articles.
        </p>
      </div>
    );
  }

  const unfollow = async (follow: Follow) => {
    // Optimistic: drop the row immediately, roll back if the API refuses.
    setItems((prev) => prev.filter((item) => item.id !== follow.id));
    setTotalCount((prev) => Math.max(0, prev - 1));
    try {
      await followsApi.unfollow(follow.id);
    } catch (e) {
      // Reload first (load resets the error), then surface the failure —
      // otherwise the reload would immediately wipe the alert.
      void load(filter, page);
      setError(e instanceof Error ? e.message : "Failed to unfollow");
    }
  };

  return (
    <div className="following-page">
      <h1>Following</h1>

      <NotificationPreferences />

      <div className="following-page__filters" role="tablist" aria-label="Follow type filter">
        {TYPE_FILTERS.map(({ label, value }) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={filter === value}
            className={`following-page__filter${filter === value ? " following-page__filter--active" : ""}`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="following-page__status" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="following-page__status">Loading…</p>
      ) : items.length === 0 ? (
        <p className="following-page__status">No follows yet.</p>
      ) : (
        <ul className="following-page__list" aria-label="Followed content">
          {items.map((follow) => (
            <li key={follow.id} className="following-page__row">
              <span className="following-page__type">{follow.followable_type}</span>
              {follow.target_path ? (
                <Link to={follow.target_path} className="following-page__label">
                  {follow.target_label || "(deleted)"}
                </Link>
              ) : (
                <span className="following-page__label">{follow.target_label || "(deleted)"}</span>
              )}
              <button
                type="button"
                className="following-page__unfollow"
                onClick={() => void unfollow(follow)}
                aria-label={`Unfollow ${follow.target_label ?? follow.followable_type}`}
              >
                Unfollow
              </button>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="following-page__pagination">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => void load(filter, page - 1)}
          >
            &larr; Previous
          </button>
          <span>
            Page {page} of {totalPages} ({totalCount} total)
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => void load(filter, page + 1)}
          >
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  );
}