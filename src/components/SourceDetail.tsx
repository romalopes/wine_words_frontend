import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import PageHero from "./PageHero";
import { sourcesApi, reviewsApi, articlesApi } from "../services/api";
import usePagedList from "../hooks/usePagedList";
import Pagination from "./Pagination";
import ReviewCard from "./ReviewCard";
import ArticleCard from "./ArticleCard";
import { type ContentStatus } from "./ContentStatusActions";
import { errorMessage } from "../utils/errors";
import { useAuth } from "../contexts/AuthContext";
import { canManageWinesRole } from "../constants/roles";
import type { Source } from "../types/api";
import type { Review } from "../types/review";
import type { Article } from "../types/article";

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

  // Ids of the cards whose status transition is in flight — their buttons
  // render disabled, exactly like the detail pages' `statusBusy`.
  const [busyReviewId, setBusyReviewId] = useState<number | null>(null);
  const [busyArticleId, setBusyArticleId] = useState<number | null>(null);

  // Draft / Publish / Archive from the source page. Publishing stamps
  // `published_at` the first time, matching the detail-page behaviour.
  const changeReviewStatus = async (review: Review, next: ContentStatus) => {
    if (next === review.status) return;
    try {
      setBusyReviewId(review.id);
      const payload =
        next === "published" && !review.published_at
          ? { status: next, published_at: new Date().toISOString() }
          : { status: next };
      await reviewsApi.updateStatus(review.id, payload);
      // Patch the card in place, like the detail pages do — no list refetch,
      // so no loading flicker.
      reviews.patchItem(review.id, {
        status: next,
        published_at: payload.published_at ?? review.published_at ?? null,
      });
    } catch (err) {
      alert(errorMessage(err, "Failed to update review"));
    } finally {
      setBusyReviewId(null);
    }
  };

  const changeArticleStatus = async (article: Article, next: ContentStatus) => {
    if (next === article.status) return;
    try {
      setBusyArticleId(article.id);
      const payload =
        next === "published" && !article.published_at
          ? { status: next, published_at: new Date().toISOString() }
          : { status: next };
      await articlesApi.updateStatus(article.id, payload);
      // Patch the card in place, like the detail pages do — no list refetch,
      // so no loading flicker.
      articles.patchItem(article.id, {
        status: next,
        published_at: payload.published_at ?? article.published_at ?? null,
      });
    } catch (err) {
      alert(errorMessage(err, "Failed to update article"));
    } finally {
      setBusyArticleId(null);
    }
  };

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
      <PageHero
        kicker="Settings · Sources"
        title={label}
        description={
          meta ? `${meta.reviews_count} reviews · ${meta.articles_count} articles` : undefined
        }
        primaryAction={{ label: "← All Sources", to: "/sources" }}
      />

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
                  canManage
                  onStatusChange={(status) =>
                    changeReviewStatus(review, status)
                  }
                  user={user}
                  statusBusy={busyReviewId === review.id}
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
                <ArticleCard
                  key={article.id}
                  article={article}
                  canManage
                  canManageContent
                  onOpen={() => navigate(`/articles/${article.slug}`)}
                  onStatusChange={(status) =>
                    changeArticleStatus(article, status)
                  }
                  user={user}
                  statusBusy={busyArticleId === article.id}
                />
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

