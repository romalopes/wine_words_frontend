import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  winesApi,
  reviewsApi,
  tasteParametersApi,
  vintagesApi,
} from "../services/api";
import { volumeLabel } from "../data/wineVolumes";
import { useAuth } from "../contexts/AuthContext";
import { canManageWinesRole } from "../constants/roles";
import DOMPurify from "dompurify";
import ReviewForm from "./ReviewForm";
import BackToSource from "./BackToSource";
import LikeButton from "./LikeButton";
import CommentSection from "./comments/CommentSection";
import { useReturnToLink } from "../hooks/useReturnToLink";
import AdaptiveImage from "./AdaptiveImage";
import { useAnalyticsBeacon } from "../hooks/useAnalyticsBeacon";
import type { Wine } from "../types/wine";
import type { Review } from "../types/review";
import { wineImageGallery } from "../utils/wineImages";

function RichComment({ html }: { html: string }) {
  return (
    <div
      className="review-card__comment"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  );
}

function timeAgo(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return `${m} minute${m !== 1 ? "s" : ""} ago`;
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    return `${h} hour${h !== 1 ? "s" : ""} ago`;
  }
  if (diffSec < 2592000) {
    const d = Math.floor(diffSec / 86400);
    return `${d} day${d !== 1 ? "s" : ""} ago`;
  }
  const m = Math.floor(diffSec / 2592000);
  return `${m} month${m !== 1 ? "s" : ""} ago`;
}

function WineDetail() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const returnToLink = useReturnToLink();
  // Admins, Reviewers and Editors may edit or delete wines.
  const canManageWines = canManageWinesRole(user);
  const [wine, setWine] = useState<Wine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewsByVintage, setReviewsByVintage] = useState<
    Record<number, Review[]>
  >({});
  const [loadingReviews, setLoadingReviews] = useState<
    Record<number, boolean>
  >({});
  const images = wineImageGallery(wine?.images);

  // Inline "add vintage" form (any signed-in user; enforced by the API too).
  const [showVintageForm, setShowVintageForm] = useState(false);
  const [newVintage, setNewVintage] = useState({
    year: "",
    prompt: "",
    price: "",
    no_vintage: false,
  });
  const [addingVintage, setAddingVintage] = useState(false);
  const [vintageError, setVintageError] = useState<string | null>(null);

  async function handleAddVintage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddingVintage(true);
    setVintageError(null);
    try {
      await vintagesApi.create(slug, {
        year: parseInt(newVintage.year, 10),
        prompt: newVintage.prompt || null,
        price: newVintage.price === "" ? null : parseFloat(newVintage.price),
        no_vintage: newVintage.no_vintage,
      });
      setNewVintage({ year: "", prompt: "", price: "", no_vintage: false });
      setShowVintageForm(false);
      await loadWine();
    } catch (err) {
      setVintageError(
        err instanceof Error ? err.message : "Failed to add vintage",
      );
    } finally {
      setAddingVintage(false);
    }
  }
  const [activeFormVintage, setActiveFormVintage] = useState<number | null>(
    null,
  );
  const [editingReview, setEditingReview] = useState<
    (Review & { vintageId: number }) | null
  >(null);
  const [tasteLabels, setTasteLabels] = useState<Record<string, string>>({});

  // Map taste parameter slug -> human label for the detail view.
  useEffect(() => {
    tasteParametersApi
      .list()
      .then((params) => {
        const map: Record<string, string> = {};
        (Array.isArray(params) ? params : []).forEach((p) => {
          if (p?.slug) map[p.slug] = p.label || p.slug;
        });
        setTasteLabels(map);
      })
      .catch(() => {});
  }, []);

  const loadWine = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await winesApi.show(slug);
      setWine(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load wine");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const { trackView } = useAnalyticsBeacon();

  // Track view after successful authorized load
  useEffect(() => {
    if (wine?.id) {
      trackView("Wine", wine.id);
    }
  }, [wine?.id, trackView]);

  useEffect(() => {
    loadWine();
  }, [loadWine]);

  async function loadReviews(vintageId: number) {
    setLoadingReviews((prev) => ({ ...prev, [vintageId]: true }));
    try {
      const data = await reviewsApi.list(slug, vintageId);
      setReviewsByVintage((prev) => ({ ...prev, [vintageId]: data }));
    } catch {
      // silently fail
    } finally {
      setLoadingReviews((prev) => ({ ...prev, [vintageId]: false }));
    }
  }

  function handleToggleReviews(vintageId: number) {
    if (reviewsByVintage[vintageId]) {
      setReviewsByVintage((prev) => {
        const next = { ...prev };
        delete next[vintageId];
        return next;
      });
    } else {
      loadReviews(vintageId);
    }
  }

  function handleReviewSaved(vintageId: number) {
    setActiveFormVintage(null);
    setEditingReview(null);
    loadReviews(vintageId);
  }

  async function handleDeleteReview(reviewId: number, vintageId: number) {
    if (!window.confirm("Delete this review?")) return;
    try {
      await reviewsApi.destroy(reviewId);
      loadReviews(vintageId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete review");
    }
  }

  if (loading) {
    return (
      <div className="wine-app">
        <p className="wine-management__loading">Loading wine details…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wine-app">
        <p className="wine-management__error">{error}</p>
        <Link to="/wines" className="auth-form__submit">
          Back to Wines
        </Link>
      </div>
    );
  }

  if (!wine) return null;

  const colorClass = wine.color?.toLowerCase().replace(/\s+/g, "-") || "unknown";
  const categories = Array.isArray(wine.categories) ? wine.categories : [];
  const grapes = Array.isArray(wine.grapes) ? wine.grapes : [];
  const regions = Array.isArray(wine.regions) ? wine.regions : [];

  return (
    <div className="wine-app wine-detail-page">
      <BackToSource />
      <Link to="/wines" className="wine-detail__back">
        &larr; Back to Wines
      </Link>
      <header className="wine-detail-page__hero">
        <div>
          <p className="wine-kicker">{wine.producer?.name || "Wine"}</p>
          <div className="wine-detail-page__title-row">
            <h1>{wine.name}</h1>
            {wine.color && <span className={`wine-profile-detail__color wine-profile-detail__color--${colorClass}`}>{wine.color}</span>}
          </div>
          <p className="wine-detail-page__intro">
            {wine.prompt || "Explore this bottle’s origins, style, and tasting profile."}
          </p>
          <LikeButton
            kind="wine"
            identifier={wine.slug || wine.id}
            initialLiked={wine.liked_by_current_user}
            initialCount={wine.likes_count}
            onChange={({ liked, likes_count }) =>
              setWine((prev) => prev ? { ...prev, liked_by_current_user: liked, likes_count } : prev)
            }
          />
        </div>
        {canManageWines && (
          <div className="wine-detail-page__hero-actions">
          <Link to={`/wines/${wine.slug}/edit`} className="auth-form__submit">
            Edit Wine
          </Link>
          <button
            className="wine-management__delete-btn"
            onClick={async () => {
              if (
                !window.confirm(
                  `Delete "${wine.name}"? This action cannot be undone.`,
                )
              )
                return;
              try {
                await winesApi.destroy(wine.slug);
                navigate("/wines", { replace: true });
              } catch (err) {
                alert(
                  err instanceof Error ? err.message : "Failed to delete wine",
                );
              }
            }}
          >
            Delete Wine
          </button>
          </div>
        )}
      </header>

      <div className="wine-detail-page__layout">
        <div className="wine-detail-page__main">
          <section className="wine-detail-page__card">
            <p className="wine-profile-detail__eyebrow">Bottle details</p>
            <h2>About this wine</h2>
            <div className="wine-detail-page__bottle">
              {images.length > 0 && (
                <span className="wine-detail__images">
                  {images.map((src, i) => <AdaptiveImage key={i} src={src} alt={`${wine.name} ${i + 1}`} />)}
                </span>
              )}
              <dl className="wine-detail-page__specs">
                <div><dt>Producer</dt><dd>{wine.producer ? <Link to={returnToLink(`/producers/${wine.producer.slug}`)}>{wine.producer.name}</Link> : "Not specified"}</dd></div>
                <div><dt>Color</dt><dd>{wine.color || "Not specified"}</dd></div>
                <div><dt>Style</dt><dd>{wine.sparkling ? "Sparkling" : wine.fortified ? "Fortified" : "Still"}</dd></div>
                <div><dt>Closure</dt><dd>{wine.closure || "Not specified"}</dd></div>
                <div><dt>Alcohol</dt><dd>{wine.alcohol_percentage != null ? `${wine.alcohol_percentage}%` : "Not specified"}</dd></div>
                <div><dt>Volume</dt><dd>{wine.volume_ml != null ? (volumeLabel(wine.volume_ml) ?? `${wine.volume_ml}ml`) : "Not specified"}</dd></div>
              </dl>
            </div>
          </section>

          {wine.parameters && wine.parameters.length > 0 && (
            <section className="wine-detail-page__card">
              <p className="wine-profile-detail__eyebrow">Taste profile</p>
              <h2>On the palate</h2>
              <div className="wine-profile-detail__params">
                {wine.parameters.map((param) => (
                  <div key={param.id || param.taste_parameter_id} className="wine-profile-detail__param">
                    <div className="wine-profile-detail__param-heading">
                      <span>{tasteLabels[param.taste_parameter_slug] || param.taste_parameter_slug}</span>
                      <strong>{param.score}<small>/5</small></strong>
                    </div>
                    <div className="wine-meter" aria-label={`${tasteLabels[param.taste_parameter_slug] || param.taste_parameter_slug}: ${param.score} out of 5`}><span style={{ width: `${(param.score / 5) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="wine-detail-page__origins" aria-label="Wine origins and categories">
          <div className="wine-detail-page__origin-group">
            <p className="wine-profile-detail__eyebrow">Categories</p>
            {categories.length > 0 ? <div className="wine-profile-detail__chips">{categories.map((category) => <Link key={category.id} to={returnToLink(`/categories/${category.slug}`)} className="wine-profile-detail__chip">{category.name}</Link>)}</div> : <p className="wine-profile-detail__empty">Not specified</p>}
          </div>
          <div className="wine-profile-detail__origin-divider" />
          <div className="wine-detail-page__origin-group">
            <p className="wine-profile-detail__eyebrow">Grapes</p>
            {grapes.length > 0 ? <div className="wine-profile-detail__chips">{grapes.map((grape) => <Link key={grape.id} to={returnToLink(`/grapes/${grape.slug}`)} className="wine-profile-detail__chip">{grape.name}</Link>)}</div> : <p className="wine-profile-detail__empty">Not specified</p>}
          </div>
          <div className="wine-profile-detail__origin-divider" />
          <div className="wine-detail-page__origin-group">
            <p className="wine-profile-detail__eyebrow">Regions</p>
            {regions.length > 0 ? <div className="wine-profile-detail__chips">{regions.map((region) => <Link key={region.id} to={returnToLink(`/regions/${region.slug}`)} className="wine-profile-detail__chip wine-profile-detail__chip--region">{region.name}</Link>)}</div> : <p className="wine-profile-detail__empty">Not specified</p>}
          </div>
        </aside>
      </div>

      <div className="wine-detail__section wine-detail-page__vintages-section">
        <h2>Vintages</h2>
        {canManageWines &&
          (showVintageForm ? (
            <form
              className="review-form"
              onSubmit={handleAddVintage}
              style={{ marginBottom: 16 }}
            >
              {vintageError && (
                <p className="review-form__error">{vintageError}</p>
              )}
              <div className="review-form__field">
                <label htmlFor="new-vintage-year">Vintage Year *</label>
                <input
                  id="new-vintage-year"
                  type="number"
                  required
                  min={1900}
                  max={new Date().getFullYear() + 5}
                  value={newVintage.year}
                  onChange={(e) =>
                    setNewVintage((prev) => ({ ...prev, year: e.target.value }))
                  }
                  placeholder="e.g. 2020"
                  autoFocus
                />
              </div>
              <div className="review-form__field">
                <label htmlFor="new-vintage-prompt">Prompt (optional)</label>
                <input
                  id="new-vintage-prompt"
                  type="text"
                  value={newVintage.prompt}
                  onChange={(e) =>
                    setNewVintage((prev) => ({
                      ...prev,
                      prompt: e.target.value,
                    }))
                  }
                  placeholder="Tasting notes for this vintage"
                />
              </div>
              <div className="review-form__field">
                <label htmlFor="new-vintage-price">Price (optional)</label>
                <input
                  id="new-vintage-price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={newVintage.price}
                  onChange={(e) =>
                    setNewVintage((prev) => ({
                      ...prev,
                      price: e.target.value,
                    }))
                  }
                  placeholder="e.g. 89.50"
                />
              </div>
              <div
                className="review-form__field"
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <input
                  id="new-vintage-nv"
                  type="checkbox"
                  checked={Boolean(newVintage.no_vintage)}
                  onChange={(e) =>
                    setNewVintage((prev) => ({
                      ...prev,
                      no_vintage: e.target.checked,
                    }))
                  }
                />
                <label htmlFor="new-vintage-nv" style={{ margin: 0 }}>
                  No vintage (NV)
                </label>
              </div>
              <div className="review-form__actions">
                <button
                  type="submit"
                  className="auth-form__submit"
                  disabled={addingVintage}
                >
                  {addingVintage ? "Adding…" : "Add Vintage"}
                </button>
                <button
                  type="button"
                  className="review-form__cancel"
                  onClick={() => {
                    setShowVintageForm(false);
                    setVintageError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <p style={{ marginBottom: 16 }}>
              <button
                type="button"
                className="review-add-btn"
                onClick={() => setShowVintageForm(true)}
              >
                + Add Vintage
              </button>
            </p>
          ))}
        {wine.vintages && wine.vintages.length > 0 ? (
          <div className="wine-detail__vintages">
            {wine.vintages.map((vintage) => (
              <div key={vintage.id} className="wine-detail__vintage">
                <div className="wine-detail__vintage-header">
                  <strong>{vintage.no_vintage ? "NV" : vintage.year}</strong>
                  {vintage.price != null && (
                    <span style={{ marginLeft: 8, fontWeight: 400 }}>
                      ${Number(vintage.price).toFixed(2)}
                    </span>
                  )}
                  <button
                    type="button"
                    className="review-toggle-btn"
                    onClick={() => handleToggleReviews(vintage.id)}
                  >
                    {reviewsByVintage[vintage.id]
                      ? "Hide reviews"
                      : `Reviews${
                          vintage.reviews_count != null
                            ? ` (${vintage.reviews_count})`
                            : ""
                        }`}
                  </button>
                </div>
                {vintage.prompt && <p>{vintage.prompt}</p>}

                {loadingReviews[vintage.id] && (
                  <p className="review-loading">Loading reviews…</p>
                )}

                {reviewsByVintage[vintage.id]?.length === 0 && (
                    <p className="review-empty">
                      No reviews yet. Be the first!
                    </p>
                  )}

                {(reviewsByVintage[vintage.id]?.length ?? 0) > 0 && (
                    <div className="review-list">
                      {(reviewsByVintage[vintage.id] ?? []).map((review) => (
                        <div
                          key={review.id}
                          className={`review-card ${review.status === "draft" ? "review-card--draft" : ""}`}
                        >
                          <div className="review-card__top">
                            <span className="review-card__score">
                              {review.score}
                            </span>
                            <span className="review-card__status">
                              {review.status}
                            </span>
                            {review.published_at && (
                              <span className="review-card__time">
                                {timeAgo(review.published_at)}
                              </span>
                            )}
                            {(review.drink_from != null ||
                              review.drink_to != null) && (
                              <span className="review-card__time">
                                Drink {review.drink_from ?? ""}
                                {review.drink_to != null
                                  ? `–${review.drink_to}`
                                  : ""}
                                {review.drink_plus ? "+" : ""}
                              </span>
                            )}
                          </div>
                          {review.comment && (
                            <RichComment html={review.comment} />
                          )}
                          {Array.isArray(review.images) &&
                            review.images.length > 0 && (
                              <div className="review-card__images">
                                {review.images.map((src, i) => (
                                  <img
                                    key={i}
                                    src={src}
                                    alt={`${review.title || "Review"} ${i + 1}`}
                                  />
                                ))}
                              </div>
                            )}
                          <div className="review-card__meta">
                            <span className="review-card__reviewer">
                              {review.reviewer_name}
                            </span>
                          </div>
                          {user &&
                            (user.id === review.user_id || canManageWines) && (
                              <div className="review-card__actions">
                                <button
                                  type="button"
                                  className="review-card__edit"
                                  onClick={() => {
                                    setActiveFormVintage(null);
                                    setEditingReview({
                                      ...review,
                                      vintageId: vintage.id,
                                    });
                                  }}
                                >
                                  Edit
                                </button>
                                {review.status === "draft" ? (
                                  <button
                                    type="button"
                                    className="review-card__publish"
                                    onClick={async () => {
                                      try {
                                        await reviewsApi.update(review.id, {
                                          status: "published",
                                          published_at:
                                            new Date().toISOString(),
                                        });
                                        loadReviews(vintage.id);
                                      } catch (err) {
                                        alert(
                                          err instanceof Error
                                            ? err.message
                                            : "Failed to publish review",
                                        );
                                      }
                                    }}
                                  >
                                    Publish
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="review-card__unpublish"
                                    onClick={async () => {
                                      try {
                                        await reviewsApi.update(review.id, {
                                          status: "draft",
                                        });
                                        loadReviews(vintage.id);
                                      } catch (err) {
                                        alert(
                                          err instanceof Error
                                            ? err.message
                                            : "Failed to unpublish review",
                                        );
                                      }
                                    }}
                                  >
                                    Unpublish
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="review-card__delete"
                                  onClick={() =>
                                    handleDeleteReview(review.id, vintage.id)
                                  }
                                  title="Delete review"
                                >
                                  &times;
                                </button>
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  )}

                {editingReview && editingReview.vintageId === vintage.id && (
                  <div className="review-form-wrapper">
                    <ReviewForm
                      wineSlug={slug}
                      vintageId={vintage.id}
                      vintageYear={vintage.year}
                      review={editingReview}
                      onSaved={() => handleReviewSaved(vintage.id)}
                      onCancel={() => setEditingReview(null)}
                    />
                  </div>
                )}

                {canManageWines && (
                  <div className="review-form-wrapper">
                    {activeFormVintage === vintage.id ? (
                      <ReviewForm
                        wineSlug={slug}
                        vintageId={vintage.id}
                        vintageYear={vintage.year}
                        onSaved={() => handleReviewSaved(vintage.id)}
                        onCancel={() => setActiveFormVintage(null)}
                      />
                    ) : (
                      <button
                        type="button"
                        className="review-add-btn"
                        onClick={() => {
                          setEditingReview(null);
                          setActiveFormVintage(vintage.id);
                        }}
                      >
                        + Add Review
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="wine-management__empty-state">
            No vintages recorded yet.
          </p>
        )}
      </div>

      <CommentSection kind="wine" identifier={wine.slug || wine.id} />
    </div>
  );
}

export default WineDetail;
