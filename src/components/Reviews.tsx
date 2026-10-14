import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { reviewsApi, categoriesApi, winesApi } from "../services/api";
import { useCategoryOrder, sortCategoryNames } from "../hooks/useCategoryOrder";
import ReviewForm from "./ReviewForm";
import ReviewCard from "./ReviewCard";
import type { ContentStatus } from "./ContentStatusActions";
import { useAuth } from "../contexts/AuthContext";
import { canManageWinesRole } from "../constants/roles";
import Pagination from "./Pagination";
import { isAbortError, useSearch } from "../hooks/useSearch";
import {
  effectiveSearchTerm,
  MIN_SEARCH_LENGTH,
} from "../services/searchParams";
import type { SearchParams } from "../services/searchParams";
import type { Review } from "../types/review";
import type { RequestSignal, ReviewGroup } from "../types/api";
import { SearchBar } from "./search";

interface InlineReviewEditProps {
  review: Review;
  editingReview: Review | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * The inline edit form rendered inside a card when its Edit button is pressed.
 * `ReviewForm` owns its own field state, so this only has to decide whether the
 * card is the one being edited.
 */
function InlineReviewEdit({
  review,
  editingReview,
  onClose,
  onSaved,
}: InlineReviewEditProps) {
  if (!editingReview || editingReview.id !== review.id) return null;
  return (
    <div
      className="review-form-wrapper"
      style={{ marginTop: 12 }}
      onClick={(e) => e.stopPropagation()}
    >
      <ReviewForm
        review={editingReview}
        vintageYear={editingReview.vintage_year ?? null}
        vintageNoVintage={editingReview.vintage_no_vintage === true}
        onSaved={onSaved}
        onCancel={onClose}
      />
    </div>
  );
}

function Reviews() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canSeeAll = canManageWinesRole(user);
  const canManageContent = canManageWinesRole(user);
  const categoryOrder = useCategoryOrder("sort_order_review");
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [mineLoaded, setMineLoaded] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get("category") ?? null;
  const [categoryNameToId, setCategoryNameToId] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    categoriesApi
      .list()
      .then((cats) => {
        const map: Record<string, number> = {};
        (Array.isArray(cats) ? cats : []).forEach((c) => {
          map[c.name] = c.id;
        });
        setCategoryNameToId(map);
      })
      .catch(() => {});
  }, []);

  const categoryId = selectedCategory
    ? categoryNameToId[selectedCategory]
    : null;
  const isUncategorised = selectedCategory === "Uncategorised";

  // Content managers can act on any review; everyone else only on their own.
  function canManage(review: Review) {
    return Boolean(
      user && (canSeeAll || Number(review.user_id) === Number(user.id)),
    );
  }

  // Scope and status filters
  const [scope, setScope] = useState("all"); // "all" | "mine"
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "draft" | "published"

  // Bumped by `reload()` after a create/edit/delete. It is part of the fetch
  // callback's identity, so changing it forces a refetch even when the page
  // number and filters are unchanged.
  const [reloadToken, setReloadToken] = useState(0);

  // Fetch function for useSearch. Every non-search filter is passed as a
  // primitive dependency so the callback identity stays stable between
  // renders; otherwise useSearch would refetch on every single render.
  const fetchReviews = useCallback(
    async (params: SearchParams, options?: RequestSignal) => {
      const merged = {
        scope,
        status: statusFilter === "all" ? undefined : statusFilter,
        ...(isUncategorised
          ? { uncategorised: "true" }
          : categoryId
            ? { category_id: categoryId }
            : {}),
        ...params,
      };
      if (merged.per_page === undefined) merged.per_page = 20;
      return reviewsApi.all(merged, options);
    },
    [scope, statusFilter, isUncategorised, categoryId, reloadToken],
  );

  const {
    data,
    loading: listLoading,
    params,
    setPage,
    setSort,
    setFilter,
    removeFilter,
    patchItem,
  } = useSearch(
    fetchReviews,
    {
      page: 1,
      per_page: 20,
      sort: "relevance",
      query: "",
    },
    { minQueryLength: MIN_SEARCH_LENGTH, enabled: Boolean(selectedCategory) && scope !== "mine" },
  );

  // The term that is actually searched for: blank until the user has typed
  // enough characters, so short input shows the unfiltered listing.
  const searchTerm = effectiveSearchTerm(params.query);

  // All reviews grouped by category. The paginated feed only backs the
  // "category selected" listing; with no category selected the page renders
  // the grouped view instead (cards capped at 12 per section).
  const [groups, setGroups] = useState<ReviewGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // `signal` lets a superseded load be cancelled: the term changes on every
  // debounced pause, and a late response for the previous term must neither
  // overwrite the new one nor clear its spinner.
  const loadGroups = useCallback(async (options?: RequestSignal) => {
    setLoadingGroups(true);
    try {
      // The grouped view backs the no-category listing, so it must honour the
      // same free-text search as the paginated feed; otherwise the query would
      // be fetched and then thrown away.
      const rows = await reviewsApi.grouped(
        searchTerm ? { query: searchTerm } : {},
        options,
      );
      setGroups(Array.isArray(rows) ? rows : []);
    } catch (error) {
      // An abort is the expected outcome of a superseded search, not a failure.
      if (!isAbortError(error)) setGroups([]);
    } finally {
      if (!options?.signal?.aborted) setLoadingGroups(false);
    }
  }, [searchTerm]);

  // Load the grouped view whenever the listing is not scoped to one category,
  // and re-run it when the search term changes.
  useEffect(() => {
    if (selectedCategory) return;
    const controller = new AbortController();
    void loadGroups({ signal: controller.signal });
    return () => controller.abort();
  }, [selectedCategory, searchTerm, loadGroups]);

  // The grouped view has its own loader, so either one counts as "loading".
  const loading =
    listLoading || (!selectedCategory && scope !== "mine" && loadingGroups);

  // Refetch the active listing. Bumping the token guarantees a request even
  // when the page number is already 1 and no filter changed.
  const reload = () => {
    setReloadToken((token) => token + 1);
    setPage(1);
    if (!selectedCategory) void loadGroups();
  };

  // Add-review form visibility and the review currently being edited.
  // `ReviewForm` owns its own field state (including its wine search picker),
  // so only the review being edited needs to live here.
  const [showForm, setShowForm] = useState(false);
  const toggleFilterDrawer = () => {
    // Placeholder for filter drawer toggle logic
  };
  const [editingReview, setEditingReview] = useState<Review | null>(null);

  const closeForm = () => {
    setShowForm(false);
  };
  const cancelForm = () => {
    setShowForm(false);
  };

  const onSaved = () => {
    closeForm();
    if (user) void loadMyReviews();
    reload();
  };

  const loadMyReviews = useCallback(async () => {
    if (!user) {
      setMyReviews([]);
      setMineLoaded(true);
      return;
    }
    setMineLoaded(false);
    try {
      const resp = await reviewsApi.myReviews();
      setMyReviews(Array.isArray(resp) ? resp : []);
    } catch {
      setMyReviews([]);
    } finally {
      setMineLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void loadMyReviews();
    } else {
      setMyReviews([]);
      setMineLoaded(true);
    }
  }, [user, loadMyReviews]);

  // Id of the card whose status transition is in flight — its buttons render
  // disabled, exactly like the detail page's `statusBusy`.
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null);

  // Status change and delete handlers
  const onStatusChange = async (review: Review, newStatus: ContentStatus) => {
    if (newStatus === review.status) return;
    try {
      setStatusBusyId(review.id);
      const payload =
        newStatus === "published" && !review.published_at
          ? { status: newStatus, published_at: new Date().toISOString() }
          : { status: newStatus };
      await reviewsApi.updateStatus(review.id, payload);
      const patch = {
        status: newStatus,
        published_at: payload.published_at ?? review.published_at,
      };
      // Patch every rendered copy in place — paginated feed, grouped view and
      // "mine" list — instead of refetching, so only that card re-renders
      // (no loading flicker), exactly like ReviewDetail does.
      patchItem(review.id, patch);
      setGroups((prev) =>
        prev.map((group) => ({
          ...group,
          reviews: (group.reviews ?? []).map((r) =>
            r.id === review.id ? { ...r, ...patch } : r,
          ),
        })),
      );
      if (scope === "mine") {
        setMyReviews((prev) =>
          prev.map((r) =>
            r.id === review.id ? { ...r, ...patch } : r,
          ),
        );
      }
    } catch (err) {
      console.error("Failed to update review status", err);
    } finally {
      setStatusBusyId(null);
    }
  };

  const onDelete = async (id: number) => {
    if (!window.confirm("Delete this review?")) return;
    try {
      await reviewsApi.destroy(id);
      if (scope === "mine") {
        setMyReviews((prev) => prev.filter((r) => r.id !== id));
      }
      reload();
    } catch (err) {
      console.error("Failed to delete review", err);
    }
  };

  // Active-filter chips shown in the search bar.
  const activeFilters: Record<string, string> = {};
  if (scope !== "all") activeFilters.scope = scope;
  if (statusFilter !== "all") activeFilters.status = statusFilter;
  if (selectedCategory) activeFilters.category = selectedCategory;

  // Each chip is backed by a different owner, so removal is dispatched per key
  // rather than funnelled through the search hook's params.
  const handleRemoveFilter = (key: string) => {
    if (key === "scope") return setScope("all");
    if (key === "status") return setStatusFilter("all");
    if (key === "sort") return setSort("relevance");
    if (key === "category") {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("category");
        return next;
      });
      return;
    }
    removeFilter(key as keyof SearchParams);
  };

  return (
    <main className="wine-app">
      <div className="wine-management__header">
        <div>
          <h1>Reviews</h1>
        </div>
        {canManageContent && (
          <button
            type="button"
            className="auth-form__submit"
            onClick={() => (showForm ? closeForm() : setShowForm(true))}
          >
            + Add Review
          </button>
        )}
      </div>

      {showForm && (
        <div className="review-form-wrapper">
          {/* New review: render ReviewForm with no pre-supplied bottle so its
              wine/vintage search picker opens immediately — the same flow edit
              review uses behind its "Change wine/vintage" button. */}
          <ReviewForm vintageYear={null} onSaved={onSaved} onCancel={cancelForm} />
        </div>
      )}

      {/* Search bar */}
      <SearchBar
        placeholder="Search reviews…"
        onSearch={(value) => setFilter("query", effectiveSearchTerm(value))}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        sortOptions={[
          { value: "relevance", label: "Relevance" },
          { value: "recent", label: "Most recent" },
          { value: "oldest", label: "Oldest" },
          { value: "score_high", label: "Score high→low" },
          { value: "score_low", label: "Score low→high" },
        ]}
        currentSort={(params.sort as string) ?? "relevance"}
        onSortChange={setSort}
        showFilterButton={true}
        onFilterToggle={toggleFilterDrawer}
      />

      
      {!showForm && loading ? (
        <p className="wine-management__loading">Loading reviews…</p>
      ) : (
        <>
          {/* Scope: everyone's reviews vs my reviews */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {(!canManageContent
              ? []
              : [
                  { key: "all", label: "All Reviews" },
                  ...(user ? [{ key: "mine", label: "My Reviews" }] : []),
                ]
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                style={{
                  border: "1px solid #d7c8bb",
                  borderRadius: "999px",
                  padding: "8px 14px",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  background: scope === key ? "#27615e" : "#fff",
                  color: scope === key ? "#f7fff9" : "#4f4440",
                  borderColor: scope === key ? "#27615e" : "#d7c8bb",
                }}
                onClick={() => setScope(key as "all" | "mine")}
              >
                {label}
              </button>
            ))}
          </div>

          {canManageContent && (
            <div className="content-status-filter-row">
              {["all", "draft", "published"].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`content-status-filter ${statusFilter === filter ? "content-status-filter--active" : ""}`}
                  onClick={() => setStatusFilter(filter)}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          )}

          {(() => {
            // Guests/Readers only ever see published reviews.
            const effectiveScope = canManageContent ? scope : "all";
            const effectiveStatus = canManageContent
              ? statusFilter
              : "published";
            const source: Review[] =
              effectiveScope === "mine"
                ? myReviews
                : selectedCategory
                  ? (data?.data ?? [])
                  : groups.flatMap((group) =>
                      Array.isArray(group.reviews) ? group.reviews : [],
                    );
            const filtered = (
              effectiveStatus === "all"
                ? source
                : source.filter((r) => r?.status === effectiveStatus)
            ).filter((r) => {
              if (!selectedCategory) return true;
              const catNames = Array.isArray(r.categories)
                ? r.categories.map((c) => c.name)
                : [];
              if (catNames.length === 0)
                return selectedCategory === "Uncategorised";
              return catNames.includes(selectedCategory);
            });

            // Deduplicate by review id (guards against eager-load joins in the
            // API producing one row per review→category association).
            const seen = new Set<number>();
            const deduped = filtered.filter((r) => {
              if (seen.has(r.id)) return false;
              seen.add(r.id);
              return true;
            });

            if (effectiveScope === "mine" && !user) {
              return (
                <p className="wine-management__empty-state">
                  Sign in to see your reviews.
                </p>
              );
            }
            if (effectiveScope === "mine" && !mineLoaded) {
              return (
                <p className="wine-management__loading">Loading reviews…</p>
              );
            }
            if (deduped.length === 0) {
              return (
                <p className="wine-management__empty-state">
                  {searchTerm
                    ? `No reviews matching “${searchTerm}”.`
                    : source.length === 0
                      ? effectiveScope === "mine"
                        ? "You haven't written any reviews yet."
                        : "No reviews yet. Be the first!"
                      : `No ${statusFilter} reviews.`}
                </p>
              );
            }
            // When a category is selected, show a flat list (no grouping).
            if (selectedCategory) {
              return (
                <div className="content-grid">
                  {deduped.map((review) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      query={searchTerm}
                      onOpen={() => navigate(`/reviews/${review.slug}`)}
                      canManage={canManage(review)}
                      onEdit={() => setEditingReview(review)}
                      onStatusChange={(status) => onStatusChange(review, status)}
                      user={user}
                      statusBusy={statusBusyId === review.id}
                      onDelete={() => onDelete(review.id)}
                    >
                      <InlineReviewEdit
                        review={review}
                        editingReview={editingReview}
                        onSaved={onSaved}
                        onClose={() => setEditingReview(null)}
                      />
                    </ReviewCard>
                  ))}
                </div>
              );
            }

            // Group by category — a review can belong to multiple categories,
            // so it is listed under every category it is tagged with.
            const grouped = deduped.reduce(
              (acc, review) => {
                const catNames = Array.isArray(review.categories)
                  ? review.categories.map((c) => c.name)
                  : [];
                if (catNames.length === 0) {
                  if (!acc["Uncategorised"]) acc["Uncategorised"] = [];
                  acc["Uncategorised"].push(review);
                } else {
                  catNames.forEach((name) => {
                    if (!acc[name]) acc[name] = [];
                    acc[name].push(review);
                  });
                }
                return acc;
              },
              {} as Record<string, Review[]>,
            );

            // True per-category totals from the grouped API (the rendered cards
            // are capped at 12 per group, so counts can't be derived from
            // `grouped`).
            const groupCounts =
              effectiveScope === "mine" || selectedCategory
                ? null
                : Object.fromEntries(
                    groups.map((g) => [
                      g.category,
                      g.count ?? (g.reviews || []).length,
                    ]),
                  );

            // Sort categories: by admin-defined sort order, Uncategorised last
            const sortedCategories = sortCategoryNames(
              Object.keys(grouped),
              categoryOrder,
            );

            return (
              <div className="content-grid-groups">
                {sortedCategories.map((category) => (
                  <section key={category} className="content-grid-group">
                    <h2 className="content-grid-group__title">
                      {category}
                      <Link
                        className="group-show-all"
                        to={`/reviews?category=${encodeURIComponent(category)}`}
                      >
                        Show all (
                        {groupCounts?.[category] ??
                          grouped[category]?.length ??
                          0}
                        )
                      </Link>
                    </h2>
                    <div className="content-grid">
                      {(grouped[category] ?? []).slice(0, 12).map((review) => (
                        <ReviewCard
                          key={review.id}
                          review={review}
                          query={searchTerm}
                          onOpen={() => navigate(`/reviews/${review.slug}`)}
                          canManage={canManage(review)}
                          onEdit={() => setEditingReview(review)}
                          onStatusChange={(status) =>
                            onStatusChange(review, status)
                          }
                          user={user}
                          statusBusy={statusBusyId === review.id}
                          onDelete={() => onDelete(review.id)}
                        >
                          <InlineReviewEdit
                            review={review}
                            editingReview={editingReview}
                            onSaved={onSaved}
                            onClose={() => setEditingReview(null)}
                          />
                        </ReviewCard>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            );
          })()}

          {selectedCategory && (
            <Pagination
              page={params.page ?? 1}
              totalPages={data?.totalPages ?? 1}
              totalCount={data?.total ?? 0}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </main>
  );
}

export default Reviews;
