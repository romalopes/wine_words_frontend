import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { articlesApi, categoriesApi } from "../services/api";
import { useCategoryOrder, sortCategoryNames } from "../hooks/useCategoryOrder";
import ArticleForm from "./ArticleForm";
import ArticleCard from "./ArticleCard";
import { type ContentStatus } from "./ContentStatusActions";
import { useAuth } from "../contexts/AuthContext";
import { canManageWinesRole } from "../constants/roles";
import Pagination from "./Pagination";
import { isAbortError, useSearch } from "../hooks/useSearch";
import {
  effectiveSearchTerm,
  MIN_SEARCH_LENGTH,
} from "../services/searchParams";
import type { SearchParams } from "../services/searchParams";
import type { Article } from "../types/article";
import type { ArticleGroup, RequestSignal } from "../types/api";
import { SearchBar } from "./search";

function Articles() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canSeeAll = canManageWinesRole(user);
  // Admins, Editors and Reviewers see the management filters and the
  // add button; Guests/Readers only see published articles.
  const canManageContent = canManageWinesRole(user);
  const categoryOrder = useCategoryOrder("sort_order_article");
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get("category") ?? null;
  const [myArticles, setMyArticles] = useState<Article[]>([]);
  // False until the first load of "my articles" completes (avoids flashing
  // the "You haven't written any articles yet." empty state while loading).
  const [mineLoaded, setMineLoaded] = useState<boolean>(false);
  // Category name -> id map for resolving ?category= to category_id
  const [categoryNameToId, setCategoryNameToId] = useState<Record<string, number>>({});
  // Add-article form visibility.
  const [showForm, setShowForm] = useState<boolean>(false);
  // Scope and status filters.
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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

  // When the selected category changes, hide the add form (user navigated away).
  useEffect(() => {
    setShowForm(false);
  }, [selectedCategory]);

  // Content managers can act on any article; everyone else only on their own.
  function canManage(article: Article) {
    return Boolean(
      user && (canSeeAll || Number(article.user_id) === Number(user.id)),
    );
  }

  // Bumped by `reload()` after a create/edit/delete. It is part of the fetch
  // callback's identity, so changing it forces a refetch even when the page
  // number and filters are unchanged.
  const [reloadToken, setReloadToken] = useState(0);

  // Fetch function for useSearch. Every non-search filter is passed as a
  // primitive dependency so the callback identity stays stable between
  // renders; otherwise useSearch would refetch on every single render.
  const fetchArticles = useCallback(
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
      return articlesApi.list(merged, options);
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
    fetchArticles,
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

  // All articles grouped by category. The paginated feed only backs the
  // "category selected" listing; with no category selected the page renders
  // the grouped view instead (cards capped at 12 per section).
  const [groups, setGroups] = useState<ArticleGroup[]>([]);
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
      const rows = await articlesApi.grouped(
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

  const loadMyArticles = useCallback(async () => {
    try {
      const rows = await articlesApi.myArticles();
      setMyArticles(Array.isArray(rows) ? rows : []);
    } catch {
      setMyArticles([]);
    } finally {
      setMineLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (user) loadMyArticles();
    else {
      setMyArticles([]);
      setMineLoaded(true);
    }
  }, [user, loadMyArticles]);

  // Id of the card whose status transition is in flight — its buttons render
  // disabled, exactly like the detail page's `statusBusy`.
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null);

  async function changeStatus(article: Article, next: ContentStatus) {
    if (next === article.status) return;
    try {
      setStatusBusyId(article.id);
      const payload =
        next === "published" && !article.published_at
          ? { status: next, published_at: new Date().toISOString() }
          : { status: next };
      await articlesApi.updateStatus(article.id, payload);
      const patch = {
        status: next,
        published_at: payload.published_at ?? article.published_at,
      };
      // Patch every rendered copy in place — paginated feed, grouped view and
      // "mine" list — instead of refetching, so only that card re-renders
      // (no loading flicker), exactly like ArticleDetail does.
      patchItem(article.id, patch);
      setGroups((prev) =>
        prev.map((group) => ({
          ...group,
          articles: (group.articles ?? []).map((a) =>
            a.id === article.id ? { ...a, ...patch } : a,
          ),
        })),
      );
      if (scope === "mine") {
        setMyArticles((prev) =>
          prev.map((a) =>
            a.id === article.id ? { ...a, ...patch } : a,
          ),
        );
      }
    } catch (err) {
      alert((err as Error).message || "Failed to update article");
    } finally {
      setStatusBusyId(null);
    }
  }

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

  const toggleFilterDrawer = () => {
    // Placeholder for filter drawer toggle logic
  };

  return (
    <main className="wine-app">
      <div className="wine-management__header">
        <div>
          <h1>{selectedCategory || "Articles"}</h1>
          {selectedCategory && (
            <Link className="group-show-all" to="/articles">
              ← Show all articles
            </Link>
          )}
        </div>
        {canManageContent && (
          <button
            type="button"
            className="auth-form__submit"
            onClick={() => setShowForm((prev) => !prev)}
          >
            {showForm ? "Close" : "+ Add Article"}
          </button>
        )}
      </div>

      {showForm && (
        <div className="review-form-wrapper">
          <ArticleForm
            onSaved={() => {
              setShowForm(false);
              reload();
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Search bar */}
      <SearchBar
        placeholder="Search articles…"
        onSearch={(value) => setFilter("query", effectiveSearchTerm(value))}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        sortOptions={[
          { value: "relevance", label: "Relevance" },
          { value: "recent", label: "Most recent" },
          { value: "oldest", label: "Oldest" },
        ]}
        currentSort={(params.sort as string) ?? "relevance"}
        onSortChange={setSort}
        showFilterButton={true}
        onFilterToggle={toggleFilterDrawer}
      />

      {!showForm && loading ? (
        <p className="wine-management__loading">Loading articles…</p>
      ) : (
        <>
          {/* Scope: everyone's articles vs my articles */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {(!canManageContent
              ? []
              : [
                  { key: "all", label: "All Articles" },
                  ...(user ? [{ key: "mine", label: "My Articles" }] : []),
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
            // Guests/Readers only ever see published articles.
            const effectiveScope = canManageContent ? scope : "all";
            const effectiveStatus = canManageContent
              ? statusFilter
              : "published";
            const source: Article[] =
              effectiveScope === "mine"
                ? myArticles
                : selectedCategory
                  ? (data?.data ?? [])
                  : groups.flatMap((group) =>
                      Array.isArray(group.articles) ? group.articles : [],
                    );
            const filtered = (
              effectiveStatus === "all"
                ? source
                : source.filter((a) => a?.status === effectiveStatus)
            ).filter((a) => {
              if (!selectedCategory) return true;
              const catNames = Array.isArray(a.categories)
                ? a.categories.map((c) => c.name)
                : [];
              if (catNames.length === 0)
                return selectedCategory === "Uncategorised";
              return catNames.includes(selectedCategory);
            });

            // Deduplicate by article id (guards against eager-load joins in the
            // API producing one row per article→category association).
            const seen = new Set<number>();
            const deduped = filtered.filter((a) => {
              if (seen.has(a.id)) return false;
              seen.add(a.id);
              return true;
            });

            if (effectiveScope === "mine" && !user) {
              return (
                <p className="wine-management__empty-state">
                  Sign in to see your articles.
                </p>
              );
            }
            if (effectiveScope === "mine" && !mineLoaded) {
              return (
                <p className="wine-management__loading">Loading articles…</p>
              );
            }
            if (deduped.length === 0) {
              return (
                <p className="wine-management__empty-state">
                  {searchTerm
                    ? `No articles matching “${searchTerm}”.`
                    : source.length === 0
                      ? effectiveScope === "mine"
                        ? "You haven't written any articles yet."
                        : "No articles yet. Write the first one!"
                      : `No ${statusFilter} articles.`}
                </p>
              );
            }

            // When a category is selected, show a flat list (no grouping).
            if (selectedCategory) {
              return (
                <div className="content-grid">
                  {deduped.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      query={searchTerm}
                      canManage={canManage(article)}
                      canManageContent={canManageContent}
                      onOpen={() => navigate(`/articles/${article.slug}`)}
                      onStatusChange={(status) => changeStatus(article, status)}
                      user={user}
                      statusBusy={statusBusyId === article.id}
                    />
                  ))}
                </div>
              );
            }

            // Group by category — an article can belong to multiple categories,
            // so it is listed under every category it is tagged with.
            const grouped = deduped.reduce(
              (acc, article) => {
                const catNames = Array.isArray(article.categories)
                  ? article.categories.map((c) => c.name)
                  : [];
                if (catNames.length === 0) {
                  if (!acc["Uncategorised"]) acc["Uncategorised"] = [];
                  acc["Uncategorised"].push(article);
                } else {
                  catNames.forEach((name) => {
                    if (!acc[name]) acc[name] = [];
                    acc[name].push(article);
                  });
                }
                return acc;
              },
              {} as Record<string, Article[]>,
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
                      g.count ?? (g.articles || []).length,
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
                        to={`/articles?category=${encodeURIComponent(category)}`}
                      >
                        Show all (
                        {groupCounts?.[category] ??
                          grouped[category]?.length ??
                          0}
                        )
                      </Link>
                    </h2>
                    <div className="content-grid">
                      {(grouped[category] ?? []).slice(0, 12).map((article) => (
                        <ArticleCard
                          key={article.id}
                          article={article}
                          query={searchTerm}
                          canManage={canManage(article)}
                          canManageContent={canManageContent}
                          onOpen={() => navigate(`/articles/${article.slug}`)}
                          onStatusChange={(status) =>
                            changeStatus(article, status)
                          }
                          user={user}
                          statusBusy={statusBusyId === article.id}
                        />
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

export default Articles;

