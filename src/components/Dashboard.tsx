import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { articlesApi, reviewsApi, statsApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import ArticleCard from "./ArticleCard";
import ReviewCard from "./ReviewCard";
import { SearchInput, AdvancedSearchFilters } from "./search";
import { isAbortError } from "../hooks/useSearch";
import {
  effectiveSearchTerm,
  MIN_SEARCH_LENGTH,
} from "../services/searchParams";
import { errorMessage } from "../utils/errors";
import type { Article } from "../types/article";
import type { Review } from "../types/review";
import type { Stats } from "../types/stats";

/** One promo card on the dashboard. `statKey` indexes the API stats payload. */
interface DashboardCard {
  title: string;
  statKey: keyof Stats;
  tone: "neutral" | "gold" | "rose";
  to: string;
  cta: string;
}

const dashboardCards: DashboardCard[] = [
  {
    title: "Producers",
    statKey: "producers",
    tone: "neutral",
    to: "/producers",
    cta: "Browse wineries →",
  },
  {
    title: "Wines",
    statKey: "wines",
    tone: "gold",
    to: "/wines",
    cta: "Explore the catalogue →",
  },
  {
    title: "Reviews",
    statKey: "reviews",
    tone: "rose",
    to: "/reviews",
    cta: "Read reviews →",
  },
  {
    title: "Articles",
    statKey: "articles",
    tone: "gold",
    to: "/articles",
    cta: "Read articles →",
  },
];

const EMPTY_STATS: Stats = { producers: 0, wines: 0, reviews: 0, articles: 0 };

/** Rails returns either a bare array or a paginated envelope; keep the array. */
function asArray<T>(response: T[] | { items?: T[] }): T[] {
  return Array.isArray(response) ? response : (response.items ?? []);
}

/**
 * The dashboard search previews this many rows per content type; anything
 * beyond it is reachable through the "see all" link on the full listing.
 */
const SEARCH_PREVIEW_PER_TYPE = 6;

interface SearchResults {
  reviews: Review[];
  reviewTotal: number;
  articles: Article[];
  articleTotal: number;
}

const EMPTY_SEARCH_RESULTS: SearchResults = {
  reviews: [],
  reviewTotal: 0,
  articles: [],
  articleTotal: 0,
};

/**
 * Rows plus the server's own total. The preview only asks for a handful of
 * rows, so `total_count` is what lets the section say "Reviews (12)" and offer
 * a "see all" link that is honest about how much is left.
 */
function asList<T>(response: T[] | { items?: T[]; total_count?: number }): {
  items: T[];
  total: number;
} {
  if (Array.isArray(response))
    return { items: response, total: response.length };
  const items = response.items ?? [];
  return { items, total: response.total_count ?? items.length };
}

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [recentArticles, setRecentArticles] = useState<Article[]>([]);
  const [recentReviews, setRecentReviews] = useState<Review[]>([]);
  // Page-level search over reviews and articles.
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] =
    useState<SearchResults>(EMPTY_SEARCH_RESULTS);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Whether the shared panel's form is expanded (the panel header's
  // "Hide form" / "Show form" toggle), separate from whether the panel is
  // shown at all.
  const [formExpanded, setFormExpanded] = useState(true);
  const [searchReviews, setSearchReviews] = useState(true);
  const [searchArticles, setSearchArticles] = useState(true);
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, any>>(
    {},
  );
  // Blank until the term is long enough to be worth a request, matching the
  // reviews/articles listings (and keeping the API off one-letter searches).
  const searchTerm = effectiveSearchTerm(searchInput, MIN_SEARCH_LENGTH);

  useEffect(() => {
    statsApi
      .get()
      .then(setStats)
      .catch(() => setStats(EMPTY_STATS));
    articlesApi
      .list()
      .then((data) => setRecentArticles(asArray(data).slice(0, 10)))
      .catch(() => setRecentArticles([]));
    reviewsApi
      .all()
      .then((data) => setRecentReviews(asArray(data).slice(0, 10)))
      .catch(() => setRecentReviews([]));
  }, []);

  // Search both content types for the typed term. One request each, in
  // parallel, both abortable: a superseded term's response must not overwrite
  // the newer one, and clearing the box must not leave results behind.
  useEffect(() => {
    if (!searchTerm) {
      setSearchResults(EMPTY_SEARCH_RESULTS);
      setSearchError(null);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    setSearching(true);
    setSearchError(null);
    // `page: 1` is what makes the endpoint paginate — without it Rails returns
    // the whole array (no `total_count`), so the preview would be unbounded and
    // could not offer a "see all".
    Promise.all([
      reviewsApi.all(
        {
          ...advancedFilters,
          query: searchTerm,
          page: 1,
          per_page: SEARCH_PREVIEW_PER_TYPE,
        },
        { signal: controller.signal },
      ),
      articlesApi.list(
        {
          ...advancedFilters,
          query: searchTerm,
          page: 1,
          per_page: SEARCH_PREVIEW_PER_TYPE,
        },
        { signal: controller.signal },
      ),
    ])
      .then(([reviewResponse, articleResponse]) => {
        if (cancelled) return;
        const reviews = asList(reviewResponse);
        const articles = asList(articleResponse);
        setSearchResults({
          reviews: reviews.items,
          reviewTotal: reviews.total,
          articles: articles.items,
          articleTotal: articles.total,
        });
      })
      .catch((error: unknown) => {
        // An abort is the expected outcome of a superseded search.
        if (cancelled || isAbortError(error)) return;
        setSearchResults(EMPTY_SEARCH_RESULTS);
        setSearchError(errorMessage(error, "Search failed"));
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [searchTerm, advancedFilters]);

  return (
    <main className="wine-app">
      <p className="lede dashboard__lede">
        Welcome{user ? `, ${user.email.split("@")[0]}` : ""} to Wine Words.
      </p>
      {!user && (
        <p className="dashboard__sign-in-prompt">
          <Link className="text-link" to="/login">
            Sign in or create an account
          </Link>{" "}
          to save tasting profiles and write reviews.
        </p>
      )}
      <section
        className="dashboard__search"
        aria-label="Search reviews and articles"
      >
        <div className="advanced-search-toggle-row">
          <button
            type="button"
            className="advanced-search-toggle"
            onClick={() => {
              setAdvancedOpen(!advancedOpen);
              setFormExpanded(!advancedOpen);
            }}
            aria-expanded={advancedOpen}
          >
            {advancedOpen ? "Hide advanced search" : "Advanced search →"}
          </button>
        </div>

        {/* The simple search box hides while the advanced panel is open — the
            same exclusive-mode behavior as /wines. */}
        {!advancedOpen && (
          <>
            <label className="dashboard__search-label" htmlFor="dashboard-search">
              Search reviews and articles
            </label>
            <SearchInput
              id="dashboard-search"
              placeholder="Search reviews and articles…"
              onChange={setSearchInput}
            />
          </>
        )}

        {/* The advanced panel is independent of the search term: it can be
            opened before typing anything, and its filter changes re-run the
            search once a term exists. The panel itself is the shared advanced
            search (the /wines visual); only the content-type picker is
            dashboard-specific. */}
        {advancedOpen && (
          <div className="dashboard__advanced-area">
            <div className="dashboard__advanced-contenttypes">
              <h4>Content types</h4>
              <div className="dashboard__advanced-checkboxes">
                <label>
                  <input
                    type="checkbox"
                    checked={searchReviews}
                    onChange={(e) => setSearchReviews(e.target.checked)}
                    disabled={searching}
                  />
                  Search reviews
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={searchArticles}
                    onChange={(e) => setSearchArticles(e.target.checked)}
                    disabled={searching}
                  />
                  Search articles
                </label>
              </div>
              <p className="dashboard__advanced-note">
                Both types are selected by default. Clear one to search only
                that content type.
              </p>
            </div>

            <AdvancedSearchFilters
              title="Advanced Search"
              open={formExpanded}
              onToggleOpen={setFormExpanded}
              initialFilters={advancedFilters}
              onChange={setAdvancedFilters}
              submitLabel="Search"
              onSubmit={(filters) => {
                setAdvancedFilters(filters);
                setAdvancedOpen(false);
              }}
              onClear={() => setAdvancedFilters({})}
            />
          </div>
        )}

        {searchTerm && (
          <div className="dashboard__search-results">
            <p className="dashboard__search-status" role="status">
              {searching
                ? "Searching…"
                : (searchError ??
                  (!searchResults.reviews.length &&
                  !searchResults.articles.length
                    ? `No reviews or articles match “${searchTerm}”.`
                    : ""))}
            </p>

            {searchResults.reviews.length > 0 && (
              <>
                <h2 className="dashboard__search-heading">
                  Reviews ({searchResults.reviewTotal})
                  {searchResults.reviewTotal > searchResults.reviews.length && (
                    <Link
                      className="dashboard__search-all"
                      to={`/reviews?query=${encodeURIComponent(searchTerm)}`}
                    >
                      See all reviews →
                    </Link>
                  )}
                </h2>
                <div className="content-grid">
                  {searchResults.reviews.map((review) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      query={searchTerm}
                      onOpen={() =>
                        navigate(`/reviews/${review.slug || review.id}`)
                      }
                    />
                  ))}
                </div>
              </>
            )}

            {searchResults.articles.length > 0 && (
              <>
                <h2 className="dashboard__search-heading">
                  Articles ({searchResults.articleTotal})
                  {searchResults.articleTotal >
                    searchResults.articles.length && (
                    <Link
                      className="dashboard__search-all"
                      to={`/articles?query=${encodeURIComponent(searchTerm)}`}
                    >
                      See all articles →
                    </Link>
                  )}
                </h2>
                <div className="content-grid">
                  {searchResults.articles.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      query={searchTerm}
                      onOpen={() =>
                        navigate(`/articles/${article.slug || article.id}`)
                      }
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* <div className="content-grid dashboard__stats-grid">
        {dashboardCards.map((card) => (
          <Link key={card.title} to={card.to} className="dashboard__stat-card">
            <div
              className={`dashboard__stat-card-band dashboard__stat-card-band--${card.tone}`}
            />
            <div className="dashboard__stat-card-body">
              <h2 className="dashboard__stat-card-title">{card.title}</h2>
              <p className="dashboard__stat-card-copy">
                {stats[card.statKey] || 0} {card.title.toLowerCase()} in the
                library.
              </p>
              <span className="dashboard__stat-card-cta">{card.cta}</span>
            </div>
          </Link>
        ))}
      </div> */}

      {/* While a term is being searched the listing sections step aside, so the
          page shows the results rather than two competing collections. */}
      {!searchTerm && recentReviews.length > 0 && (
        <>
          <h2 className="dashboard__section-title">Latest Reviews</h2>
          <div className="content-grid">
            {recentReviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onOpen={() => navigate(`/reviews/${review.slug || review.id}`)}
              />
            ))}
          </div>
        </>
      )}

      {!searchTerm && recentArticles.length > 0 && (
        <>
          <h2 className="dashboard__section-title">Latest Articles</h2>
          <div className="content-grid dashboard__content-grid">
            {recentArticles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onOpen={() =>
                  navigate(`/articles/${article.slug || article.id}`)
                }
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

export default Dashboard;
