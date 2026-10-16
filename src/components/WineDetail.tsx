import { useState, useEffect, useCallback } from "react";
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

function RichComment({ html }) {
  return (
    <div
      className="review-card__comment"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  );
}
import ReviewForm from "./ReviewForm";
import BackToSource from "./BackToSource";
import LikeButton from "./LikeButton";
import CommentSection from "./comments/CommentSection";
import { useReturnToLink } from "../hooks/useReturnToLink";
import AdaptiveImage from "./AdaptiveImage";
import { useAnalyticsBeacon } from "../hooks/useAnalyticsBeacon";

function timeAgo(dateStr) {
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
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const returnToLink = useReturnToLink();
  // Admins, Reviewers and Editors may edit or delete wines.
  const canManageWines = canManageWinesRole(user);
  const [wine, setWine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewsByVintage, setReviewsByVintage] = useState({});
  const [loadingReviews, setLoadingReviews] = useState({});

  // Inline "add vintage" form (any signed-in user; enforced by the API too).
  const [showVintageForm, setShowVintageForm] = useState(false);
  const [newVintage, setNewVintage] = useState({
    year: "",
    prompt: "",
    price: "",
    no_vintage: false,
  });
  const [addingVintage, setAddingVintage] = useState(false);
  const [vintageError, setVintageError] = useState(null);

  async function handleAddVintage(e) {
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
      setVintageError(err.message || "Failed to add vintage");
    } finally {
      setAddingVintage(false);
    }
  }
  const [activeFormVintage, setActiveFormVintage] = useState(null);
  const [editingReview, setEditingReview] = useState(null);
  const [tasteLabels, setTasteLabels] = useState({});

  // Map taste parameter slug -> human label for the detail view.
  useEffect(() => {
    tasteParametersApi
      .list()
      .then((params) => {
        const map = {};
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
      setError(err.message || "Failed to load wine");
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

  async function loadReviews(vintageId) {
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

  function handleToggleReviews(vintageId) {
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

  function handleReviewSaved(vintageId) {
    setActiveFormVintage(null);
    setEditingReview(null);
    loadReviews(vintageId);
  }

  async function handleDeleteReview(reviewId, vintageId) {
    if (!window.confirm("Delete this review?")) return;
    try {
      await reviewsApi.destroy(reviewId);
      loadReviews(vintageId);
    } catch (err) {
      alert(err.message || "Failed to delete review");
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

  return (
    <div className="wine-app">
      <BackToSource />
      <Link to="/wines" className="wine-detail__back">
        &larr; Back to Wines
      </Link>
      <div className="wine-detail__header">
        <div>
          <p className="wine-kicker">{wine.producer?.name}</p>
          <h1>{wine.name}</h1>
          <LikeButton
            kind="wine"
            identifier={wine.slug || wine.id}
            initialLiked={wine.liked_by_current_user}
            initialCount={wine.likes_count}
            onChange={({ liked, likes_count }) =>
              setWine((prev) =>
                prev
                  ? { ...prev, liked_by_current_user: liked, likes_count }
                  : prev,
              )
            }
          />
        </div>
        <span
          className={`wine-management__color-badge wine-management__color-badge--${wine.color?.toLowerCase()}`}
        >
          {wine.color}
        </span>
      </div>

      {wine.prompt && <p className="wine-detail__prompt">{wine.prompt}</p>}

      <section className="detail-card">
        <div className="wine-detail__media-facts">
          {Array.isArray(wine.images) && wine.images.length > 0 && (
            <span className="wine-detail__images">
              {wine.images.map((src, i) => (
                <AdaptiveImage key={i} src={src} alt={`${wine.name} ${i + 1}`} />
              ))}
            </span>
          )}
          <ul className="wine-facts" aria-label="Wine details">
          <li>
            <strong>Producer:</strong>{" "}
            {wine.producer ? (
              <Link to={returnToLink(`/producers/${wine.producer.slug}`)}>
                {wine.producer.name}
              </Link>
            ) : (
              "—"
            )}
          </li>
          <li>
            <strong>Categories:</strong>{" "}
            {Array.isArray(wine.categories) && wine.categories.length > 0
              ? wine.categories.map((cat, i) => (
                  <span key={cat.id}>
                    <Link to={returnToLink(`/categories/${cat.slug}`)}>
                      {cat.name}
                    </Link>
                    {i < wine.categories.length - 1 ? ", " : ""}
                  </span>
                ))
              : "—"}
          </li>
          <li>
            <strong>Color:</strong> {wine.color || "—"}
          </li>
          <li>
            <strong>Sparkling:</strong> {wine.sparkling ? "Yes ✨" : "No"}
          </li>
          <li>
            <strong>Closure:</strong> {wine.closure || "—"}
          </li>
          <li>
            <strong>Alcohol:</strong>{" "}
            {wine.alcohol_percentage != null
              ? `${wine.alcohol_percentage}%`
              : "—"}
          </li>
          <li>
            <strong>Volume:</strong>{" "}
            {wine.volume_ml != null
              ? (volumeLabel(wine.volume_ml) ?? `${wine.volume_ml}ml`)
              : "—"}
          </li>
          <li>
            <strong>Grapes:</strong>{" "}
            {Array.isArray(wine.grapes) && wine.grapes.length > 0
              ? wine.grapes.map((grape, grapeIndex) => (
                  <span key={grape.id || grapeIndex}>
                    {grapeIndex > 0 && ", "}
                    <Link to={returnToLink(`/grapes/${grape.slug}`)}>
                      {grape.name}
                    </Link>
                  </span>
                ))
              : "—"}
          </li>
          <li>
            <strong>Regions:</strong>{" "}
            {Array.isArray(wine.regions) && wine.regions.length > 0
              ? wine.regions.map((region, regionIndex) => (
                  <span key={region.id || regionIndex}>
                    {regionIndex > 0 && ", "}
                    <Link to={returnToLink(`/regions/${region.slug}`)}>
                      {region.name}
                    </Link>
                  </span>
                ))
              : "—"}
          </li>
          </ul>
        </div>
      </section>

      {canManageWines && (
        <div className="wine-detail__actions">
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
                alert(err.message || "Failed to delete wine");
              }
            }}
          >
            Delete Wine
          </button>
        </div>
      )}

      <div className="wine-detail__section">
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

                {reviewsByVintage[vintage.id] &&
                  reviewsByVintage[vintage.id].length === 0 && (
                    <p className="review-empty">
                      No reviews yet. Be the first!
                    </p>
                  )}

                {reviewsByVintage[vintage.id] &&
                  reviewsByVintage[vintage.id].length > 0 && (
                    <div className="review-list">
                      {reviewsByVintage[vintage.id].map((review) => (
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
                                          err.message ||
                                            "Failed to publish review",
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
                                          err.message ||
                                            "Failed to unpublish review",
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

      {wine.parameters && wine.parameters.length > 0 && (
        <div className="wine-detail__section">
          <h2>Taste Parameters</h2>
          <div className="wine-detail__params">
            {wine.parameters.map((param) => (
              <div
                key={param.id || param.taste_parameter_id}
                className="wine-detail__param"
              >
                <span className="wine-detail__param-label">
                  {tasteLabels[param.taste_parameter_slug] ||
                    param.taste_parameter_slug}
                </span>
                <div className="wine-meter">
                  <span style={{ width: `${(param.score / 5) * 100}%` }} />
                </div>
                <span className="wine-detail__param-score">{param.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default WineDetail;
