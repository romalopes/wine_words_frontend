import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { sourcesApi, reviewsApi, articlesApi } from "../services/api";
import usePagedList from "../hooks/usePagedList";
import Pagination from "./Pagination";
import ReviewCard from "./ReviewCard";
import { errorMessage } from "../utils/errors";
import { useAuth } from "../contexts/AuthContext";
import { canManageWinesRole } from "../constants/roles";
import type { Source } from "../types/api";
import type { Review } from "../types/review";
import type { Article } from "../types/article";

/** Plain-text excerpt for the article cards. */
function excerpt(html: string | null | undefined, max = 60): string {
  if (!html) return "";
  const stripped = html.replace(/<[^>]+>/g, "").trim();
  return stripped.length <= max ? stripped : stripped.slice(0, max) + "…";
}

/**
 * Source page: every review and article for one content source, each list
 * paginated independently (separate URL params so the pages don't clash).
 * Modeled on the Producers/Categories detail listings.
 */
function SourceDetail() {
  const { source } = useParams<{ source: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = canManageWinesRole(user);

  const [meta, setMeta] = useState<Source | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setMetaLoading(true);
        const data = await sourcesApi.list();
        if (!cancelled) {
          const found = (data?.sources ?? []).find((s) => s.source === source) ?? null;
          setMeta(found);
          setMetaError(found ? null : `Source "${source}" not found.`);
        }
      } catch (err) {
        if (!cancelled) setMetaError(errorMessage(err, "Failed to load source"));
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [source]);

  const reviews = usePagedList<Review>({
    fetcher: (params) => reviewsApi.all({ ...params, source }),
    enabled: Boolean(source) && canManage,
    paramKey: "review_page",
  });

  const articles = usePagedList<Article>({
    fetcher: (params) => articlesApi.list({ ...params, source }),
    enabled: Boolean(source) && canManage,
    paramKey: "article_page",
  });

  if (!canManage) {
    return (
      <main className="wine-app">
        <p className="wine-management__error">
          You do not have permission to view this page.
        </p>
        <Link to="/" className="auth-form__submit">
          Back Home
        </Link>
      </main>
    );
  }

  const label = meta?.label ?? source ?? "Source";

  return (
    <div className="wine-app">
      <div className="wine-management__header">
        <div>
          <p className="wine-kicker">Settings · Sources</p>
          <h1>{label}</h1>
          {meta && (
            <p className="wine-management__count">
              {meta.reviews_count} reviews · {meta.articles_count} articles
            </p>
          )}
        </div>
        <Link to="/sources" className="auth-form__submit wine-management__add-btn">
          ← All Sources
        </Link>
      </div>

      {metaError && <p className="wine-management__error">{metaError}</p>}

      {/* Reviews */}
      <section aria-label={`${label} reviews`} aria-busy={reviews.loading}>
        <h2 className="wine-detail__section-title">Reviews</h2>
        {reviews.loading ? (
          <p className="wine-management__loading" role="status">Loading reviews…</p>
        ) : reviews.error ? (
          <p className="wine-management__error" role="alert">{reviews.error}</p>
        ) : reviews.items.length === 0 ? (
          <div className="wine-management__empty">
            <p>No reviews for this source.</p>
          </div>
        ) : (
          <>
            <div className="content-grid">
              {reviews.items.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onOpen={() => navigate(`/reviews/${review.slug}`)}
                />
              ))}
            </div>
            <Pagination
              page={reviews.page}
              totalPages={reviews.totalPages}
              totalCount={reviews.totalCount}
              onPageChange={reviews.setPage}
            />
          </>
        )}
      </section>

      {/* Articles */}
      <section aria-label={`${label} articles`} aria-busy={articles.loading}>
        <h2 className="wine-detail__section-title">Articles</h2>
        {articles.loading ? (
          <p className="wine-management__loading" role="status">Loading articles…</p>
        ) : articles.error ? (
          <p className="wine-management__error" role="alert">{articles.error}</p>
        ) : articles.items.length === 0 ? (
          <div className="wine-management__empty">
            <p>No articles for this source.</p>
          </div>
        ) : (
          <>
            <div className="content-grid">
              {articles.items.map((article) => (
                <div
                  key={article.id}
                  className="wine-management__card"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/articles/${article.slug}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/articles/${article.slug}`);
                    }
                  }}
                >
                  {Array.isArray(article.images) && article.images.length > 0 && (
                    <img
                        src={article.primary_image}
                      alt={article.title}
                      className="wine-management__thumb"
                    />
                  )}
                  <div className="wine-management__card-header">
                    <h3>{article.title}</h3>
                  </div>
                  <p className="wine-management__region">by {article.author_name}</p>
                  {excerpt(article.body) && (
                    <p className="wine-management__region">{excerpt(article.body)}</p>
                  )}
                </div>
              ))}
            </div>
            <Pagination
              page={articles.page}
              totalPages={articles.totalPages}
              totalCount={articles.totalCount}
              onPageChange={articles.setPage}
            />
          </>
        )}
      </section>

      {metaLoading && <p className="wine-management__loading">Loading source…</p>}
    </div>
  );
}

export default SourceDetail;

