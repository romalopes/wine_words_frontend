import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import DetailHero from "./DetailHero";
import { articlesApi } from "../services/api";
import ArticleForm from "./ArticleForm";
import ContentStatusActions, { type ContentStatus } from "./ContentStatusActions";
import ReviewCard from "./ReviewCard";
import RelatedContent from "./RelatedContent";
import LikeButton from "./LikeButton";
import ShareButton from "./ShareButton";
import CommentSection from "./comments/CommentSection";
import DOMPurify from "dompurify";
import { useAuth } from "../contexts/AuthContext";
import { canManageWinesRole, canSeeSource } from "../constants/roles";
import { useImageOrientation } from "../hooks/useImageOrientation";
import SourceBadge from "./SourceBadge";
import type { Article } from "../types/article";
import { errorMessage } from "../utils/errors";
import { formatDate } from "../utils/dates";
import { normalizeArticleBody } from "../utils/articleHtml";
import BackToSource from "./BackToSource";
import DeadlineBadge from "./DeadlineBadge";
import { useReturnToLink } from "../hooks/useReturnToLink";
import { useAnalyticsBeacon } from "../hooks/useAnalyticsBeacon";

interface RichBodyProps {
  html: string;
}

/**
 * The article body: sanitised, then rebuilt into real paragraphs (legacy
 * bodies are one <div> full of <br><br>, which CSS alone cannot space).
 */
function RichBody({ html }: RichBodyProps) {
  return (
    <div
      className="article-page__body"
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(normalizeArticleBody(html)),
      }}
    />
  );
}

function ArticleDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const returnToLink = useReturnToLink();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  // Hero image resolution is needed before the early returns below so the
  // orientation hook is always called (rules of hooks). When the article has no
  // image, fall back to the first linked review's image (`fallback_review_image`).
  const hero = article
    ? article.primary_image ??
      (Array.isArray(article.images) ? article.images[0] : null) ??
      (typeof article.fallback_review_image === "string" &&
      article.fallback_review_image.length > 0
        ? article.fallback_review_image
        : null)
    : null;
  const { orientation: heroOrientation, handleLoad: handleHeroLoad } =
    useImageOrientation(hero);

  const loadArticle = useCallback(async () => {
    if (!slug) return;
    try {
      setLoading(true);
      setError(null);
      const data = await articlesApi.show(slug);
      setArticle(data);
    } catch (err) {
      setError(errorMessage(err, "Failed to load article"));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const { trackView } = useAnalyticsBeacon();

  // Track view after successful authorized load
  useEffect(() => {
    if (article?.id) {
      trackView("Article", article.id);
    }
  }, [article?.id, trackView]);

  useEffect(() => {
    loadArticle();
  }, [loadArticle]);

  // Every action below edits or deletes the article on screen, so there is
  // nothing to act on until one has loaded.
  async function changeStatus(next: ContentStatus) {
    if (!article || next === article.status) return;
    try {
      setStatusBusy(true);
      const payload =
        next === "published" && !article.published_at
          ? { status: next, published_at: new Date().toISOString() }
          : { status: next };
      await articlesApi.updateStatus(article.id, payload);
      // Patch only what changed instead of refetching the whole article —
      // the byline badge and the status toolbar read `status`, so updating
      // just these fields re-renders exactly those two areas.
      setArticle((prev) =>
        prev
          ? {
              ...prev,
              status: next,
              published_at: payload.published_at ?? prev.published_at ?? null,
            }
          : prev,
      );
    } catch (err) {
      alert(errorMessage(err, "Failed to update article"));
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleDelete() {
    if (!article) return;
    if (!window.confirm("Delete this article? This action cannot be undone.")) {
      return;
    }
    try {
      setDeleting(true);
      await articlesApi.destroy(article.id);
      navigate("/articles");
    } catch (err) {
      setError(errorMessage(err, "Failed to delete article"));
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="wine-app">
        <p className="wine-management__loading">Loading article…</p>
      </main>
    );
  }

  if (error || !article) {
    return (
      <main className="wine-app">
        <p className="wine-management__error">{error || "Article not found."}</p>
        <Link to="/articles" className="auth-form__submit">
          Back to Articles
        </Link>
      </main>
    );
  }

  const canManage = canManageWinesRole(user);
  const isAuthor = Boolean(user && Number(article.user_id) === Number(user.id));
  const canEdit = canManage || isAuthor;
  const showSource = canSeeSource(user);
  // Reviews shown under the article: link must be published AND review published.
  const visibleReviews = (article.reviews || []).filter(
    (r) => r.link_status === "published" && r.status === "published",
  );
  // The serializer omits these collections entirely when empty, so they are
  // read once here into plain arrays the JSX below can rely on.
  const categories = article.categories ?? [];
  const tags = article.tags ?? [];
  const vintages = article.vintages ?? [];
  const producers = article.producers ?? [];

  // Editorial header data: the primary image leads, the rest become a
  // gallery; the byline date falls back to creation because drafts (and
  // some seeded records) never get a published_at.
  // (`hero` and its orientation were resolved above, before the early returns.)
  const images = Array.isArray(article.images) ? article.images : [];
  const gallery = images.filter((src) => src !== hero);
  const kicker = categories[0]?.name ?? "Article";
  const bylineDate = formatDate(article.published_at ?? article.created_at);

  return (
    <main className="wine-app">
      <BackToSource />
      <Link to="/articles" className="wine-detail__back">
        &larr; Back to Articles
      </Link>

      <article className="article-page">
        <DetailHero
          className="article-page__hero-header"
          kicker={
            categories.length > 0 ? (
              <Link to={returnToLink(`/categories/${categories[0]?.slug}`)}>
                {kicker}
              </Link>
            ) : (
              kicker
            )
          }
          title={article.title}
          intro={article.abstract}
        >
          <div className="article-page__byline">
            <span className="article-page__byline-info">
              <span className="article-page__author">by {article.author_name}</span>
              {bylineDate && (
                <>
                  <span className="article-page__meta-dot" aria-hidden="true">
                    ·
                  </span>
                  <time
                    className="article-page__date"
                    dateTime={article.published_at ?? article.created_at ?? undefined}
                  >
                    {bylineDate}
                  </time>
                </>
              )}
              {article.status === "draft" && (
                <span className="article-page__badge">Draft</span>
              )}
              <DeadlineBadge
                deadline={article.deadline}
                status={article.status}
                overdue={article.overdue}
                daysUntilDeadline={article.days_until_deadline}
              />
              {article.status === "archived" && (
                <span className="article-page__badge">Archived</span>
              )}
              {showSource && <SourceBadge source={article.source} />}
            </span>

            <span className="article-page__byline-actions">
              <LikeButton
                kind="article"
                identifier={article.slug || article.id}
                initialLiked={article.liked_by_current_user}
                initialCount={article.likes_count}
                onChange={({ liked, likes_count }) =>
                  setArticle((prev) =>
                    prev ? { ...prev, liked_by_current_user: liked, likes_count } : prev,
                  )
                }
              />
              <ShareButton label="this article" />
            </span>
          </div>

          {(categories.length > 1 || tags.length > 0) && (
            <div className="article-page__chips">
              {categories.slice(1).map((cat) => (
                <Link
                  key={cat.id}
                  to={returnToLink(`/categories/${cat.slug}`)}
                  className="article-page__chip"
                >
                  {cat.name}
                </Link>
              ))}
              {tags.map((tag) => (
                <span key={tag} className="article-page__chip article-page__chip--tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </DetailHero>

        {canEdit && !editing && (
          <div className="wine-detail__actions article-page__actions">
            <button type="button" className="auth-form__submit" onClick={() => setEditing(true)}>
              Edit Article
            </button>
            <ContentStatusActions
              status={article.status}
              user={user}
              busy={statusBusy}
              onChange={changeStatus}
            />
            <button
              type="button"
              className="review-form__cancel"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete Article"}
            </button>
          </div>
        )}

        {hero && (
          <figure
            className={`article-page__hero${heroOrientation ? ` is-${heroOrientation}` : ""}`}
          >
            <img src={hero} alt={article.title} onLoad={handleHeroLoad} />
          </figure>
        )}
        {gallery.length > 0 && (
          <div className="article-page__gallery">
            {gallery.map((src, i) => (
              <img key={src} src={src} alt={`${article.title} ${i + 2}`} />
            ))}
          </div>
        )}

        {editing ? (
          <div className="review-form-wrapper">
            <ArticleForm
              article={article}
              onSaved={() => {
                setEditing(false);
                loadArticle();
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          article.body && <RichBody html={article.body} />
        )}

        {visibleReviews.length > 0 && (
          <div className="wine-detail__section">
            <h2>Reviews</h2>
            {/* Same card grid as the Reviews listing, read-only: the whole card
                opens the review. */}
            <div className="content-grid">
              {visibleReviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onOpen={() =>
                    navigate(returnToLink(`/reviews/${review.slug}`))
                  }
                />
              ))}
            </div>
          </div>
        )}

        {(vintages.length > 0 || producers.length > 0) && (
          <div className="wine-detail__section">
            {vintages.length > 0 && (
              <>
                <h2>Wines &amp; vintages</h2>
                <ul className="article-page__link-list">
                  {vintages.map((vintage) => (
                    <li key={vintage.id}>
                      <Link to={returnToLink(`/wines/${vintage.wine_slug}`)}>
                        {vintage.wine_name} {vintage.year}
                      </Link>
                      {vintage.region && (
                        <span className="article-page__link-meta">{vintage.region}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {producers.length > 0 && (
              <>
                <h2>Producers</h2>
                <ul className="article-page__link-list">
                  {producers.map((producer) => (
                    <li key={producer.id}>
                      <Link to={returnToLink(`/producers/${producer.slug}`)}>{producer.name}</Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <CommentSection kind="article" identifier={article.slug || article.id} />

        <RelatedContent kind="article" item={article} />
      </article>
    </main>
  );
}

export default ArticleDetail;