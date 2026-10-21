import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { reviewsApi } from "../services/api";
import ReviewForm from "./ReviewForm";
import ContentStatusActions, { type ContentStatus } from "./ContentStatusActions";
import RelatedContent from "./RelatedContent";
import LikeButton from "./LikeButton";
import ShareButton from "./ShareButton";
import CommentSection from "./comments/CommentSection";
import { useAuth } from "../contexts/AuthContext";
import { canManageWinesRole, canSeeSource } from "../constants/roles";
import { useImageOrientation } from "../hooks/useImageOrientation";
import SourceBadge from "./SourceBadge";
import DOMPurify from "dompurify";
import BackToSource from "./BackToSource";
import { useReturnToLink } from "../hooks/useReturnToLink";
import { errorMessage } from "../utils/errors";
import { formatDate } from "../utils/dates";
import { normalizeArticleBody } from "../utils/articleHtml";
import type { Review } from "../types/review";
import { useAnalyticsBeacon } from "../hooks/useAnalyticsBeacon";
import { reviewImage } from "../utils/wineImages";
import DeadlineBadge from "./DeadlineBadge";

/**
 * Renders a review comment, which is stored as Trix HTML: sanitised, then
 * rebuilt into real paragraphs so the reading column can style it (legacy
 * comments are one <div> full of <br><br>).
 */
function RichComment({ html }: { html: string }) {
  return (
    <div
      className="article-page__body"
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(normalizeArticleBody(html)),
      }}
    />
  );
}

/** Detail view for one review, with inline edit and delete. */
function ReviewDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const returnToLink = useReturnToLink();
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  // Hero image resolution is needed before the early returns below so the
  // orientation hook is always called (rules of hooks). Review imagery wins,
  // then the reviewed wine's image, then the bundled bottle fallback.
  const hero = review
    ? reviewImage(review.images, review.wine_image, review.primary_image)
    : null;
  const { orientation: heroOrientation, handleLoad: handleHeroLoad } =
    useImageOrientation(hero);

  const isOwner =
    Boolean(user && review && Number(review.user_id) === Number(user.id));
  const canEdit = canManageWinesRole(user) || isOwner;
  const showSource = canSeeSource(user);

  const loadReview = useCallback(async () => {
    if (!slug) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await reviewsApi.show(slug);
      setReview(data);
    } catch (err) {
      setError(errorMessage(err, "Failed to load review"));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const { trackView } = useAnalyticsBeacon();

  // Track view after successful authorized load
  useEffect(() => {
    if (review?.id) {
      trackView("Review", review.id);
    }
  }, [review?.id, trackView]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  async function handleDelete() {
    if (
      !window.confirm(
        "Delete this review? This action cannot be undone.",
      )
    ) {
      return;
    }
    // `review` is non-null by the time this button can be reached — the render
    // below returns early while it is still null.
    if (!review) return;

    try {
      setDeleting(true);
      await reviewsApi.destroy(review.id);
      navigate("/reviews");
    } catch (err) {
      setError(errorMessage(err, "Failed to delete review"));
      setDeleting(false);
    }
  }

  // Draft / Publish / Archive transition. Publishing also stamps
  // `published_at` the first time, matching the wine-detail publish button.
  async function changeStatus(next: ContentStatus) {
    if (!review || next === review.status) return;
    try {
      setStatusBusy(true);
      const payload =
        next === "published" && !review.published_at
          ? { status: next, published_at: new Date().toISOString() }
          : { status: next };
      await reviewsApi.updateStatus(review.id, payload);
      // Patch only what changed instead of refetching the whole review —
      // the byline badge and the status toolbar read `status`, so updating
      // just these fields re-renders exactly those two areas.
      setReview((prev) =>
        prev
          ? {
              ...prev,
              status: next,
              published_at: payload.published_at ?? prev.published_at ?? null,
            }
          : prev,
      );
    } catch (err) {
      setError(errorMessage(err, "Failed to update review"));
    } finally {
      setStatusBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="wine-app">
        <p className="wine-management__loading">Loading review…</p>
      </main>
    );
  }

  if (error || !review) {
    return (
      <main className="wine-app">
        <p className="wine-management__error">{error || "Review not found."}</p>
        <Link to="/reviews" className="auth-form__submit">
          Back to Reviews
        </Link>
      </main>
    );
  }

  // Editorial header data: the primary image leads, the rest become a
  // gallery; the byline date falls back to creation for drafts.
  // (`hero` and its orientation were resolved above, before the early returns.)
  const images = Array.isArray(review.images) ? review.images : [];
  const gallery = images.filter((src) => src !== hero);
  const categories = review.categories ?? [];
  const kicker = categories[0]?.name ?? "Review";
  const bylineDate = formatDate(review.published_at ?? review.created_at);
  const hasDrinkWindow = review.drink_from != null || review.drink_to != null;
  const showVintage = Boolean(review.vintage_year) && !review.vintage_no_vintage;

  return (
    <main className="wine-app">
      <BackToSource />
      <Link to="/reviews" className="wine-detail__back">
        &larr; Back to Reviews
      </Link>

      {error && <p className="wine-management__error">{error}</p>}

      <article className="article-page review-page">
        <header className="article-page__header">
          <p className="article-page__kicker">
            {categories.length > 0 ? (
              <Link to={returnToLink(`/categories/${categories[0]?.slug}`)}>
                {kicker}
              </Link>
            ) : (
              kicker
            )}
          </p>

          <h1 className="article-page__title">
            {review.title || "Untitled review"}
          </h1>

          {review.wine_name && review.wine_slug ? (
            <p className="article-page__deck">
              <Link to={returnToLink(`/wines/${review.wine_slug}`)}>
                {review.wine_name}
                {showVintage ? ` ${review.vintage_year}` : ""}
              </Link>
            </p>
          ) : (
            showVintage && <p className="article-page__deck">{review.vintage_year}</p>
          )}

          <div className="review-page__facts">
            {review.score != null && (
              <span className="review-page__score">{review.score}</span>
            )}
            {showVintage && (
              <span className="review-page__fact">
                <b>Vintage</b> {review.vintage_year}
              </span>
            )}
            {hasDrinkWindow && (
              <span className="review-page__fact">
                <b>Drink</b> {review.drink_from ?? ""}
                {review.drink_to != null ? `–${review.drink_to}` : ""}
                {review.drink_plus ? "+" : ""}
              </span>
            )}
          </div>

          <div className="article-page__byline">
            <span className="article-page__byline-info">
              <span className="article-page__author">by {review.reviewer_name}</span>
              {bylineDate && (
                <>
                  <span className="article-page__meta-dot" aria-hidden="true">
                    ·
                  </span>
                  <time
                    className="article-page__date"
                    dateTime={review.published_at ?? review.created_at ?? undefined}
                  >
                    {bylineDate}
                  </time>
                </>
              )}
              {review.status === "draft" && (
                <span className="article-page__badge">Draft</span>
              )}
              <DeadlineBadge
                deadline={review.deadline}
                status={review.status}
                overdue={review.overdue}
                daysUntilDeadline={review.days_until_deadline}
              />
              {review.status === "archived" && (
                <span className="article-page__badge">Archived</span>
              )}
              {showSource && <SourceBadge source={review.source} />}
            </span>

            <span className="article-page__byline-actions">
              <LikeButton
                kind="review"
                identifier={review.slug || review.id}
                initialLiked={review.liked_by_current_user}
                initialCount={review.likes_count}
                onChange={({ liked, likes_count }) =>
                  setReview((prev) =>
                    prev ? { ...prev, liked_by_current_user: liked, likes_count } : prev,
                  )
                }
              />
              <ShareButton label="this review" />
            </span>
          </div>

          {categories.length > 1 && (
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
            </div>
          )}
        </header>

        {canEdit && !editing && (
          <div className="wine-detail__actions article-page__actions">
            <ContentStatusActions
              status={review.status}
              user={user}
              busy={statusBusy}
              onChange={changeStatus}
            />
            <button
              type="button"
              className="auth-form__submit"
              onClick={() => setEditing(true)}
            >
              Edit Review
            </button>
            <button
              type="button"
              className="review-form__cancel"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete Review"}
            </button>
          </div>
        )}

        {canEdit && editing && (
          <ReviewForm
            review={review}
            vintageYear={review.vintage_year ?? null}
            onSaved={() => {
              setEditing(false);
              loadReview();
            }}
            onCancel={() => setEditing(false)}
          />
        )}

        {hero && (
          <figure
            className={`article-page__hero${heroOrientation ? ` is-${heroOrientation}` : ""}`}
          >
            <img src={hero} alt={review.title} onLoad={handleHeroLoad} />
          </figure>
        )}
        {gallery.length > 0 && (
          <div className="article-page__gallery">
            {gallery.map((src, i) => (
              <img key={src} src={src} alt={`${review.title} ${i + 2}`} />
            ))}
          </div>
        )}

        {review.comment && <RichComment html={review.comment} />}

        <CommentSection kind="review" identifier={review.slug || review.id} />

        <RelatedContent kind="review" item={review} />
      </article>
    </main>
  );
}

export default ReviewDetail;
