import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { winesApi, categoriesApi } from "../services/api";
import type { WineGroup } from "../types/api";
import type { WineListItem } from "../types/wine";
import type { Category } from "../types/catalog";
import { errorMessage } from "../utils/errors";
import { useSelectedCategory } from "../hooks/useSelectedCategory";
import { useAuth } from "../contexts/AuthContext";
import { canManageWinesRole } from "../constants/roles";
import usePagedList from "../hooks/usePagedList";
import Pagination from "./Pagination";
import WineAdvancedSearch from "./WineAdvancedSearch";
import type { SearchParams } from "./WineAdvancedSearch";
import { SearchHighlight, SearchInput } from "./search";
import { CategoryChip } from "./CategoryChip";
import LikeButton from "./LikeButton";
import CommentLink from "./comments/CommentLink";
import {
  effectiveSearchTerm,
  MIN_SEARCH_LENGTH,
} from "../services/searchParams";

/**
 * Shared wine card used by every listing on this page (advanced search,
 * category, simple search and the grouped view). One component keeps the
 * markup in sync across all four call sites.
 *
 * Optional props cover the few per-view differences:
 *  - `query` highlights matching text (simple search); empty = plain text.
 *  - `showImage` / `showSparkling` hide the thumbnail and "Sparkling" badge
 *    (the compact simple-search card omits both).
 *  - `showInteractions` renders the Like/Comment footer (grouped + simple).
 */
function WineCard({
  wine,
  query = "",
  showImage = true,
  showSparkling = true,
  showInteractions = false,
}: {
  wine: WineListItem;
  query?: string;
  showImage?: boolean;
  showSparkling?: boolean;
  showInteractions?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div
      className="wine-management__card"
      onClick={() => navigate(`/wines/${wine.slug}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/wines/${wine.slug}`);
        }
      }}
    >
      {showImage && Array.isArray(wine.images) && wine.images.length > 0 && (
        <img
          src={wine.images[0]}
          alt={wine.name}
          className="wine-management__thumb"
        />
      )}
      <div className="wine-management__card-header">
        <h3>
          <SearchHighlight text={wine.name} query={query} />
        </h3>
        <span
          className={`wine-management__color-badge wine-management__color-badge--${wine.color}`}
        >
          {wine.color}
        </span>
      </div>
      {wine.producer && (
        <p className="wine-management__producer" style={{ marginBottom: 0 }}>
          <SearchHighlight text={wine.producer.name} query={query} />
        </p>
      )}
      {Array.isArray(wine.grapes) && wine.grapes.length > 0 && (
        <p className="wine-management__grapes">
          <strong>Grapes:</strong>{" "}
          {wine.grapes.slice(0, 3).map((g, index) => (
            <span key={`${g.name}-${index}`}>
              {index > 0 && ", "}
              <SearchHighlight text={g.name} query={query} />
            </span>
          ))}
          {wine.grapes.length > 3 ? "…" : ""}
        </p>
      )}
      {Array.isArray(wine.regions) && wine.regions.length > 0 && (
        <p className="wine-management__regions">
          <strong>Regions:</strong>{" "}
          {wine.regions.slice(0, 3).map((r, index) => {
            const name = typeof r === "string" ? r : (r.name ?? String(r));
            return (
              <span key={`${name}-${index}`}>
                {index > 0 && ", "}
                <SearchHighlight text={name} query={query} />
              </span>
            );
          })}
          {wine.regions.length > 3 ? "…" : ""}
        </p>
      )}
      {showSparkling && wine.sparkling && (
        <p className="wine-management__sparkling">✨ Sparkling</p>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {(wine.vintages_count ?? 0) > 0 && (
          <p className="wine-management__vintage-count">
            {wine.vintages_count} vintage
            {wine.vintages_count !== 1 ? "s" : ""}
          </p>
        )}
        {showInteractions && (
          <div
            className="wine-management__interactions"
            onClick={(e) => e.stopPropagation()}
          >
            <LikeButton
              kind="wine"
              identifier={wine.slug || wine.id}
              initialLiked={wine.liked_by_current_user}
              initialCount={wine.likes_count}
            />
            <CommentLink kind="wine" identifier={wine.slug || wine.id} />
          </div>
        )}
      </div>
    </div>
  );
}

function SimpleResultsSummary({
  simpleQuery,
  onClear,
}: {
  simpleQuery: string;
  onClear: () => void;
}) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <p
        style={{
          fontSize: "0.8rem",
          color: "#666",
          margin: "0.35rem 0 0",
        }}
      >
        Showing wines matching “{simpleQuery}”.{" "}
        <button
          type="button"
          onClick={onClear}
          className="btn-secondary"
          style={{ padding: "0.1rem 0.6rem", fontSize: "0.8rem" }}
        >
          Clear
        </button>
      </p>
    </div>
  );
}

function SearchModeControls({
  searchMode,
  onSimple,
  onAdvanced,
}: {
  searchMode: "simple" | "advanced";
  onSimple: () => void;
  onAdvanced: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="Wine search mode"
      style={{ display: "flex", gap: "0.5rem", margin: "1rem 0" }}
    >
      <button
        type="button"
        onClick={onSimple}
        aria-pressed={searchMode === "simple"}
        className={searchMode === "simple" ? "btn-primary" : "btn-secondary"}
      >
        Simple search
      </button>
      <button
        type="button"
        onClick={onAdvanced}
        aria-pressed={searchMode === "advanced"}
        className={searchMode === "advanced" ? "btn-primary" : "btn-secondary"}
      >
        Advanced search
      </button>
    </div>
  );
}

function WineList() {
  const { user } = useAuth();
  // Admins, Reviewers and Editors may add, edit or delete wines.
  const canManageWines = canManageWinesRole(user);
  const [groups, setGroups] = useState<WineGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedCategory = useSelectedCategory();
  const [, setSearchParams] = useSearchParams();

  // ---------------------------------------------------------------------------
  // One search mode is visible at a time. Simple search is the default quick
  // bar; the existing advanced form stays available behind the toggle. Each
  // mode owns its filters and pagination state, and entering one clears the
  // other mode's results.
  // ---------------------------------------------------------------------------
  type WineSearchMode = "simple" | "advanced";
  const [searchMode, setSearchMode] = useState<WineSearchMode>("simple");
  const [simpleValue, setSimpleValue] = useState("");
  const simpleQuery = effectiveSearchTerm(simpleValue, MIN_SEARCH_LENGTH);

  // --- Advanced search state ---------------------------------------------
  // null => normal browsing; an object => show the advanced-search results.
  const [searchFilters, setSearchFilters] = useState<SearchParams | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const advancedPaged = usePagedList({
    fetcher: (params) => winesApi.advancedSearch(params),
    extraParams: searchFilters ?? {},
    perPage: 20,
    enabled: searchMode === "advanced" && searchFilters !== null,
    paramKey: "asearch_page",
  });

  // Simple free-text results. Independent pagination (qsearch_page) so the two
  // modes never fight over the URL page key. Enabled only from the third
  // character, matching Reviews/Articles.
  const simplePaged = usePagedList({
    fetcher: (params) => winesApi.advancedSearch(params),
    extraParams: { q: simpleQuery },
    perPage: 20,
    enabled: searchMode === "simple" && simpleQuery !== "",
    paramKey: "qsearch_page",
  });

  function handleAdvancedSearch(filters: SearchParams) {
    setSearchMode("advanced");
    setSearchFilters(filters);
  }

  function showSimple() {
    setSearchMode("simple");
    setSearchFilters(null);
  }

  function showAdvanced() {
    setSearchMode("advanced");
    setSimpleValue("");
  }

  function handleAdvancedClear() {
    setSearchFilters(null);
    showSimple();
    if (!selectedCategory) loadGroups();
  }

  function handleSimpleClear() {
    setSimpleValue("");
  }

  // Category name -> id map for resolving ?category= to category_id
  const [categoryNameToId, setCategoryNameToId] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    categoriesApi
      .list()
      .then((cats) => {
        const map: Record<string, number> = {};
        (Array.isArray(cats) ? (cats as Category[]) : []).forEach((c) => {
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

  // Paginated list when a category is selected (server-side filtering).
  // For "Uncategorised", send uncategorised=true instead of category_id.
  const pagedWines = usePagedList({
    fetcher: (params) => winesApi.list(params),
    extraParams: isUncategorised
      ? { uncategorised: "true" }
      : categoryId
        ? { category_id: categoryId }
        : {},
    perPage: 20,
    enabled: Boolean(selectedCategory),
  });

  // Load server-side grouped wines (12 per category) for the no-category view.
  useEffect(() => {
    if (!selectedCategory) {
      loadGroups();
    } else {
      setLoading(false);
    }
  }, [selectedCategory]);

  // Simple query first: it spans the catalogue and must win over a stale
  // category selection.
  const showingSimpleResults = searchMode === "simple" && simpleQuery !== "";
  const showingAdvancedResults =
    searchMode === "advanced" && searchFilters !== null;

  // A simple query spans the whole catalogue, so it overrides the category
  // view the same way the advanced results do. Typing takes precedence;
  // picking a category clears the term (below) and browsing resumes.
  useEffect(() => {
    setSimpleValue("");
  }, [selectedCategory]);

  // Reset simple-search pagination when the effective query changes: a new
  // search must not land on page 3 of the previous one. Skipped while
  // already on page 1 so typing does not spam no-op history updates.
  const prevSimpleQuery = useRef(simpleQuery);
  useEffect(() => {
    if (prevSimpleQuery.current === simpleQuery) return;
    prevSimpleQuery.current = simpleQuery;
    if (simplePaged.page !== 1) simplePaged.setPage(1);
  }, [simpleQuery, simplePaged]);

  async function loadGroups() {
    try {
      setLoading(true);
      setError(null);
      const data = await winesApi.grouped();
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(errorMessage(err, "Failed to load wines"));
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="wine-app">
        <p className="wine-management__loading">Loading wines…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wine-app">
        <p className="wine-management__error">{error}</p>
        <button className="auth-form__submit" onClick={loadGroups}>
          Retry
        </button>
      </div>
    );
  }

  // --- Advanced search results: flat paginated list -----------------------
  if (showingAdvancedResults) {
    return (
      <div className="wine-app">
        <div className="wine-management__header">
          <div>
            <p className="wine-kicker">Cellar</p>
            <h1>Advanced Search Results</h1>
          </div>
        </div>

        <WineAdvancedSearch
          open={advancedOpen}
          onToggleOpen={setAdvancedOpen}
          onSearch={handleAdvancedSearch}
          onClear={handleAdvancedClear}
        />

        {advancedPaged.loading ? (
          <p className="wine-management__loading">Searching wines…</p>
        ) : advancedPaged.error ? (
          <p className="wine-management__error">{advancedPaged.error}</p>
        ) : advancedPaged.items.length === 0 ? (
          <div className="wine-management__empty">
            <p>No wines match your search criteria.</p>
          </div>
        ) : (
          <>
            <div className="content-grid">
              {advancedPaged.items.map((wine) => (
                <WineCard key={wine.slug} wine={wine} />
              ))}
            </div>
            <Pagination
              page={advancedPaged.page}
              totalPages={advancedPaged.totalPages}
              totalCount={advancedPaged.totalCount}
              onPageChange={advancedPaged.setPage}
            />
          </>
        )}
      </div>
    );
  }

  // --- Simple search results: flat paginated list --------------------------
  // The query spans the whole catalogue, so — like the advanced results — it
  // takes precedence over the category view. It is checked before that view so
  // typing always wins over a stale category selection.
  if (showingSimpleResults) {
    return (
      <div className="wine-app">
        <div className="wine-management__header">
          <div>
            <p className="wine-kicker">Cellar</p>
            <h1>Search Results</h1>
          </div>
        </div>

        <SearchModeControls
          searchMode={searchMode}
          onSimple={showSimple}
          onAdvanced={showAdvanced}
        />
        <SearchInput
          value={simpleValue}
          onChange={setSimpleValue}
          placeholder="Search wines by name, producer, region, or grape…"
        />
        <SimpleResultsSummary
          simpleQuery={simpleQuery}
          onClear={handleSimpleClear}
        />

        {simplePaged.loading ? (
          <p className="wine-management__loading">Searching wines…</p>
        ) : simplePaged.error ? (
          <p className="wine-management__error">{simplePaged.error}</p>
        ) : simplePaged.items.length === 0 ? (
          <div className="wine-management__empty">
            <p>No wines found for “{simpleQuery}”.</p>
            <button className="btn-secondary" onClick={handleSimpleClear}>
              Clear search
            </button>
          </div>
        ) : (
          <>
            <p className="wine-management__count">
              {simplePaged.totalCount}{" "}
              {simplePaged.totalCount !== 1 ? "wines" : "wine"} found
            </p>
            <div className="content-grid">
              {simplePaged.items.map((wine) => (
                <WineCard
                  key={wine.slug}
                  wine={wine}
                  query={simpleQuery}
                  showImage={false}
                  showSparkling={false}
                  showInteractions
                />
              ))}
            </div>
            <Pagination
              page={simplePaged.page}
              totalPages={simplePaged.totalPages}
              totalCount={simplePaged.totalCount}
              onPageChange={simplePaged.setPage}
            />
          </>
        )}
      </div>
    );
  }

  // --- Category selected: flat paginated list ---
  if (selectedCategory) {
    return (
      <div className="wine-app">
        <div className="wine-management__header">
          <div>
            <p className="wine-kicker">Cellar</p>
            <h1>{selectedCategory} Wines</h1>
            {selectedCategory && (
              <CategoryChip
                label={selectedCategory}
                onClear={() => {
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.delete("category");
                    return next;
                  });
                }}
              />
            )}
            <Link className="group-show-all" to="/wines">
              ← Show all categories
            </Link>
          </div>
          {canManageWines && (
            <Link
              to="/wines/new"
              className="auth-form__submit wine-management__add-btn"
            >
              + Add Wine
            </Link>
          )}
        </div>

        <SearchModeControls
          searchMode={searchMode}
          onSimple={showSimple}
          onAdvanced={showAdvanced}
        />
        <SearchInput
          value={simpleValue}
          onChange={setSimpleValue}
          placeholder="Search wines by name, producer, region, or grape…"
        />

        {pagedWines.loading ? (
          <p className="wine-management__loading">Loading wines…</p>
        ) : pagedWines.items.length === 0 ? (
          <div className="wine-management__empty">
            <p>No wines found in this category.</p>
          </div>
        ) : (
          <>
            <div className="content-grid">
              {pagedWines.items.map((wine) => (
                <WineCard key={wine.slug} wine={wine} />
              ))}
            </div>
            <Pagination
              page={pagedWines.page}
              totalPages={pagedWines.totalPages}
              totalCount={pagedWines.totalCount}
              onPageChange={pagedWines.setPage}
            />
          </>
        )}
      </div>
    );
  }

  // --- No category selected: grouped-by-category view (12 per category) ---
  return (
    <div className="wine-app">
      <div className="wine-management__header">
        <div>
          <p className="wine-kicker">Cellar</p>
          <h1>Wine List</h1>
        </div>
        {canManageWines && (
          <Link
            to="/wines/new"
            className="auth-form__submit wine-management__add-btn"
          >
            + Add Wine
          </Link>
        )}
      </div>

      {/* Search mode toggle — one mode visible at a time. Simple search is the
          default; the existing Advanced Wine Search stays one click away. */}
      <SearchModeControls
        searchMode={searchMode}
        onSimple={showSimple}
        onAdvanced={showAdvanced}
      />
      {searchMode === "advanced" && (
        <WineAdvancedSearch
          open={advancedOpen}
          onToggleOpen={setAdvancedOpen}
          onSearch={handleAdvancedSearch}
          onClear={handleAdvancedClear}
        />
      )}
      {searchMode === "simple" && (
        <div style={{ marginBottom: "1rem" }}>
          <SearchInput
            value={simpleValue}
            onChange={setSimpleValue}
            placeholder="Search wines by name, producer, region, or grape…"
          />
          <p
            style={{
              fontSize: "0.8rem",
              color: "#666",
              margin: "0.35rem 0 0",
            }}
          >
            Matches wine names, producers, regions and grapes
            {simpleValue.trim() !== "" &&
              simpleValue.trim().length < MIN_SEARCH_LENGTH &&
              ` — keep typing (at least ${MIN_SEARCH_LENGTH} characters)`}
            .
          </p>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="wine-management__empty">
          <p>
            No wines found
            {canManageWines ? ". Start by adding a new wine!" : "."}
          </p>
          {canManageWines && (
            <Link to="/wines/new" className="auth-form__submit">
              + Add Your First Wine
            </Link>
          )}
        </div>
      ) : (
        <div className="content-grid-groups">
          {groups.map((group) => (
            <section key={group.category} className="content-grid-group">
              <h2 className="content-grid-group__title">
                {group.category}
                <Link
                  className="group-show-all"
                  to={`/wines?category=${encodeURIComponent(group.category)}`}
                >
                  Show all ({group.count})
                </Link>
              </h2>
              <div className="content-grid">
                {group.wines.map((wine) => (
                  <WineCard key={wine.slug} wine={wine} showInteractions />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default WineList;
