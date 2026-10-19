import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { articlesApi, categoriesApi, winesApi, producersApi, reviewsApi } from "../services/api";
import type { ArticleWritePayload } from "../types/api";
import type { Article } from "../types/article";
import type { Category } from "../types/catalog";
import { responseItems } from "../types/common";
import type { Producer, ProducerSearchResult } from "../types/producer";
import type { Review } from "../types/review";
import type { Vintage, WineListItem } from "../types/wine";
import { errorMessage } from "../utils/errors";
import ImageManager from "./ImageManager";
import RichTextEditor from "./RichTextEditor";
import WritingDraftNotice from "./WritingDraftNotice";
import { useWritingDraft } from "../hooks/useWritingDraft";
import { useAuth } from "../contexts/AuthContext";
import { canSeeSource } from "../constants/roles";
import { SOURCE_OPTIONS, sourceLabel } from "./SourceBadge";
import { uploadInlineImage } from "../services/inlineImages";

/**
 * A vintage picked for the article. The wine context is kept alongside the id
 * so the review list under each selection can label it.
 */
interface SelectedVintage {
  id: number;
  year: number | null;
  name: string;
  wine_slug: string | null;
}

interface ArticleFormState {
  title: string;
  abstract: string;
  body: string;
  category_ids: number[];
  tag_names: string;
  producer_ids: number[];
  status: string;
  source: string;
}

/** Reviews per selected vintage; a missing key means "still loading". */
type ReviewsByVintage = Record<number, Review[] | undefined>;

interface ArticleFormProps {
  article?: Article | null;
  onSaved: (saved?: Article) => void;
  onCancel?: () => void;
}

function ArticleForm({ article, onSaved, onCancel }: ArticleFormProps) {
  const isEditing = Boolean(article);

  const [form, setForm] = useState<ArticleFormState>({
    title: article?.title || "",
    abstract: article?.abstract || "",
    body: article?.body || "",
    category_ids: (article?.categories || []).map((c) => c.id),
    tag_names: (article?.tags || []).join(", "),
    producer_ids: article?.producers?.map((p) => p.id) || [],
    status: article?.status || "draft",
    source: article?.source || "manual",
  });
  // Selected vintages keep the wine context so reviews can be listed per vintage.
  const [selectedVintages, setSelectedVintages] = useState<SelectedVintage[]>(
    (article?.vintages || []).map((v) => ({
      id: v.id,
      year: v.year,
      name: v.name,
      wine_slug: v.wine_slug,
    })),
  );
  const [linkedReviewIds, setLinkedReviewIds] = useState<number[]>(
    (article?.reviews || [])
      .filter((r) => r.link_status === "published" || r.link_status === undefined)
      .map((r) => r.id),
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [wineQuery, setWineQuery] = useState("");
  const [wineResults, setWineResults] = useState<WineListItem[]>([]);
  const [searchingWines, setSearchingWines] = useState(false);
  const [producerQuery, setProducerQuery] = useState("");
  const [producerResults, setProducerResults] = useState<ProducerSearchResult[]>([]);
  const [searchingProducers, setSearchingProducers] = useState(false);
  const [reviewsByVintage, setReviewsByVintage] = useState<ReviewsByVintage>({});
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const producerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>(article?.images || []);
  const [existingImageIds, setExistingImageIds] = useState<Array<number | null>>(
    article?.image_ids || [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [uploadingInline, setUploadingInline] = useState(false);
  const writingDraft = useWritingDraft(
    user ? `wine-words:writing:${user.id}:article:${article?.id ?? "new"}` : null,
    { title: form.title, abstract: form.abstract, body: form.body },
  );

  useEffect(() => {
    // A non-paginated request answers with a bare array, so `responseItems`
    // is the safe way to read the rows here.
    categoriesApi.list().then((data) => setCategories(responseItems(data))).catch(() => {});
    producersApi.list().then((data) => setProducers(responseItems(data))).catch(() => {});
  }, []);

  // On edit, pre-existing vintages never run through toggleVintage, so their
  // reviews would stay "Loading…" forever. Fetch them once on mount.
  useEffect(() => {
    if (!isEditing || selectedVintages.length === 0) return undefined;
    let cancelled = false;
    Promise.all(
      selectedVintages.map(async (v) => {
        if (!v.wine_slug) return { id: v.id, reviews: [] as Review[] };
        try {
          const list = await reviewsApi.list(v.wine_slug, v.id);
          return { id: v.id, reviews: Array.isArray(list) ? list : [] };
        } catch {
          return { id: v.id, reviews: [] as Review[] };
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const next: ReviewsByVintage = {};
      results.forEach((r) => {
        next[r.id] = r.reviews;
      });
      setReviewsByVintage((prev) => ({ ...prev, ...next }));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced wine search for the vintage picker.
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!wineQuery.trim()) {
      setWineResults([]);
      return undefined;
    }
    searchTimer.current = setTimeout(async () => {
      setSearchingWines(true);
      try {
        const results = await winesApi.search(wineQuery.trim());
        setWineResults(Array.isArray(results) ? results : []);
      } catch {
        setWineResults([]);
      } finally {
        setSearchingWines(false);
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [wineQuery]);

  // Debounced producer search for the producer picker.
  useEffect(() => {
    if (producerSearchTimer.current) clearTimeout(producerSearchTimer.current);
    if (!producerQuery.trim()) {
      setProducerResults([]);
      return undefined;
    }
    producerSearchTimer.current = setTimeout(async () => {
      setSearchingProducers(true);
      try {
        const results = await producersApi.search(producerQuery.trim());
        setProducerResults(Array.isArray(results) ? results : []);
      } catch {
        setProducerResults([]);
      } finally {
        setSearchingProducers(false);
      }
    }, 300);
    return () => {
      if (producerSearchTimer.current) clearTimeout(producerSearchTimer.current);
    };
  }, [producerQuery]);

  function isVintageSelected(id: number) {
    return selectedVintages.some((v) => v.id === id);
  }

  async function toggleVintage(vintage: Vintage, wine: WineListItem) {
    if (isVintageSelected(vintage.id)) {
      setSelectedVintages((prev) => prev.filter((v) => v.id !== vintage.id));
      return;
    }
    setSelectedVintages((prev) => [
      ...prev,
      { id: vintage.id, year: vintage.year, name: `${wine.name} ${vintage.year}`, wine_slug: wine.slug },
    ]);
    // Load this vintage's published reviews so they can be linked.
    if (!reviewsByVintage[vintage.id]) {
      try {
        const list = await reviewsApi.list(wine.slug, vintage.id);
        setReviewsByVintage((prev) => ({
          ...prev,
          [vintage.id]: Array.isArray(list) ? list : [],
        }));
      } catch {
        setReviewsByVintage((prev) => ({ ...prev, [vintage.id]: [] }));
      }
    }
  }

  function toggleReview(reviewId: number) {
    setLinkedReviewIds((prev) =>
      prev.includes(reviewId)
        ? prev.filter((id) => id !== reviewId)
        : [...prev, reviewId],
    );
  }

  function isProducerSelected(id: number) {
    return form.producer_ids.includes(id);
  }

  function toggleProducer(producer: ProducerSearchResult) {
    const id = Number(producer.id);
    setForm((prev) => ({
      ...prev,
      producer_ids: isProducerSelected(id)
        ? prev.producer_ids.filter((pid) => pid !== id)
        : [...prev.producer_ids, id],
    }));
    setProducerQuery("");
    setProducerResults([]);
  }

  function removeProducer(id: number) {
    setForm((prev) => ({
      ...prev,
      producer_ids: prev.producer_ids.filter((pid) => pid !== id),
    }));
  }

  function updateField<K extends "title" | "abstract" | "tag_names">(
    field: K,
  ) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };
  }

  async function save(payload: ArticleWritePayload | FormData) {
    if (isEditing && article) {
      return articlesApi.update(article.id, payload);
    }
    return articlesApi.create(payload);
  }

  function buildPayload(): ArticleWritePayload {
    return {
      title: form.title,
      abstract: form.abstract,
      body: form.body,
      status: form.status,
      source: form.source,
      category_ids: form.category_ids || [],
      tag_names: form.tag_names,
      vintage_ids: selectedVintages.map((v) => v.id),
      review_ids: linkedReviewIds,
      producer_ids: form.producer_ids,
    };
  }

  function buildFormData(): FormData {
    const formData = new FormData();
    formData.append("article[title]", form.title);
    formData.append("article[abstract]", form.abstract);
    formData.append("article[body]", form.body);
    formData.append("article[status]", form.status);
    formData.append("article[source]", form.source);
    (form.category_ids || []).forEach((id) =>
      formData.append("article[category_ids][]", String(id)),
    );
    formData.append("article[tag_names]", form.tag_names);
    selectedVintages.forEach((v) =>
      formData.append("article[vintage_ids][]", String(v.id)),
    );
    linkedReviewIds.forEach((id) =>
      formData.append("article[review_ids][]", String(id)),
    );
    if (form.producer_ids.length > 0) {
      form.producer_ids.forEach((id) =>
        formData.append("article[producer_ids][]", String(id)),
      );
    }
    images.forEach((file) => formData.append("article[images][]", file));
    return formData;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (uploadingInline) return;
    setSubmitting(true);
    setError(null);

    try {
      // When new images are chosen, send multipart so Rails can attach them.
      const payload =
        images && images.length > 0 ? buildFormData() : buildPayload();
      const saved = await save(payload);
      writingDraft.clear();
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err, "Failed to save article"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="review-form article-form" onSubmit={handleSubmit}>
      <WritingDraftNotice draft={writingDraft} onRestore={(fields) => {
        setForm((prev) => ({ ...prev, title: fields.title ?? prev.title, abstract: fields.abstract ?? prev.abstract, body: fields.body ?? prev.body }));
      }} />
      <div className="article-form__metadata-grid">
      <div className="review-form__field article-form__field--wide">
        <label htmlFor="article-title">Title</label>
        <input
          id="article-title"
          type="text"
          required
          value={form.title}
          onChange={updateField("title")}
          placeholder="Article title"
        />
      </div>

      <div className="review-form__field">
        <label htmlFor="article-abstract">Abstract</label>
        <textarea
          id="article-abstract"
          rows={3}
          value={form.abstract}
          onChange={updateField("abstract")}
          placeholder="A short summary shown in listings"
        />
      </div>

      <div className="review-form__field article-form__field--wide">
        <span>Categories</span>
        <div className="category-checkboxes">
          {categories.map((category) => (
            <label key={category.id} className="category-checkbox">
              <input
                type="checkbox"
                checked={form.category_ids.includes(category.id)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setForm((prev) => ({
                    ...prev,
                    category_ids: checked
                      ? [...prev.category_ids, category.id]
                      : prev.category_ids.filter((id) => id !== category.id),
                  }));
                }}
              />
              {category.name}
            </label>
          ))}
        </div>
      </div>

      <div className="review-form__field">
        <label htmlFor="article-tags">Tags (comma separated)</label>
        <input
          id="article-tags"
          type="text"
          value={form.tag_names}
          onChange={updateField("tag_names")}
          placeholder="wine, region, vintage"
        />
      </div>
      </div>

      <div className="review-form__field">
        <span className="image-manager__label">Body</span>
        <RichTextEditor
          label="Article body"
          large
          onUploadingChange={setUploadingInline}
          uploadImage={article ? (file) => uploadInlineImage("article", article.id, file, (uploaded) => {
            const withUrls = uploaded.filter((image) => Boolean(image.url));
            setExistingImages(withUrls.map((image) => image.url!));
            setExistingImageIds(withUrls.map((image) => image.id));
          }) : undefined}
          value={form.body}
          onChange={(html) =>
            setForm((prev) => ({ ...prev, body: html }))
          }
          placeholder="Write your story…"
        />
      </div>

      <div className="review-form__field">
        <label htmlFor="article-wine-search">Wine vintages</label>
        <input
          id="article-wine-search"
          type="text"
          value={wineQuery}
          onChange={(e) => setWineQuery(e.target.value)}
          placeholder="Type to search wines…"
        />
        {searchingWines && <p className="review-card__comment">Searching…</p>}
        {!searchingWines && wineQuery.trim() && (
          <div className="wine-search-results">
            {wineResults.length === 0 && <p className="review-card__comment">No wines found.</p>}
            {wineResults.map((wine) => (
              <div key={wine.slug} className="wine-search-result">
                <strong>{wine.name}</strong>
                <div className="wine-search-result__vintages">
                  {(wine.vintages || []).length === 0 && (
                    <span className="review-card__comment">No vintages</span>
                  )}
                  {(wine.vintages || []).map((vintage) => (
                    <button
                      key={vintage.id}
                      type="button"
                      className={`review-form__status-btn ${isVintageSelected(vintage.id) ? "review-form__status-btn--active" : ""}`}
                      onClick={() => toggleVintage(vintage, wine)}
                    >
                      {vintage.year}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedVintages.length > 0 && (
          <div className="selected-vintages">
            <p className="review-card__comment">Selected vintages (click to remove):</p>
            <div className="wine-search-result__vintages">
              {selectedVintages.map((vintage) => (
                <button
                  key={vintage.id}
                  type="button"
                  className="review-form__status-btn review-form__status-btn--active"
                  onClick={() =>
                    setSelectedVintages((prev) => prev.filter((v) => v.id !== vintage.id))
                  }
                >
                  {vintage.name || `${vintage.wine_slug} ${vintage.year}`} ✕
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="review-form__field">
        <span className="image-manager__label">
          Reviews (optional — pick from the selected vintages)
        </span>
        {selectedVintages.length === 0 && (
          <p className="review-card__comment">Select some vintages above to see their reviews.</p>
        )}
        {selectedVintages.map((vintage) => {
          const list = reviewsByVintage[vintage.id];
          return (
            <div key={vintage.id} className="vintage-reviews">
              <strong>{vintage.name}</strong>
              {list === undefined && <p className="review-card__comment">Loading reviews…</p>}
              {Array.isArray(list) && list.length === 0 && (
                <p className="review-card__comment">No reviews for this vintage.</p>
              )}
              {Array.isArray(list) &&
                list.map((review) => (
                  <label key={review.id} style={{ display: "block", fontWeight: 400 }}>
                    <input
                      type="checkbox"
                      checked={linkedReviewIds.includes(review.id)}
                      onChange={() => toggleReview(review.id)}
                    />{" "}
                    {review.title || "Untitled"} (score {review.score})
                  </label>
                ))}
            </div>
          );
        })}
      </div>

      <div className="review-form__field">
        <label htmlFor="article-producers">Producers</label>
        <div className="producer-picker">
          <input
            type="text"
            id="article-producers"
            value={producerQuery}
            onChange={(e) => setProducerQuery(e.target.value)}
            placeholder="Search producers to add…"
            autoComplete="off"
          />
          {searchingProducers && <p className="wine-management__loading">Searching…</p>}
          {producerResults.length > 0 && (
            <div className="review-list">
              {producerResults.map((producer) => (
                <button
                  key={producer.id}
                  type="button"
                  className="review-card"
                  onClick={() => toggleProducer(producer)}
                >
                  <div className="review-card__top">
                    <strong>{producer.name}</strong>
                  </div>
                  {producer.address && (
                    <span className="review-card__comment">{producer.address}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {form.producer_ids.length > 0 && (
            <div className="producer-picker__chips">
              {form.producer_ids.map((id) => {
                const producer = producers.find((p) => Number(p.id) === Number(id));
                return (
                  <span key={id} className="vintage-chip">
                    <strong>{producer ? producer.name : `Producer #${id}`}</strong>
                    <button
                      type="button"
                      className="vintage-chip__remove"
                      onClick={() => removeProducer(id)}
                      title="Remove producer"
                    >
                      &times;
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="review-form__field">
        <span className="image-manager__label">Images (top of the article — click + to add, × to remove)</span>
        <ImageManager
          imageableType="article"
          images={existingImages}
          imageIds={existingImageIds}
          imageableId={article?.id ?? null}
          onFilesChange={(files) => setImages(files)}
          onImagesChange={async () => {
            // `article` is absent in create mode, where there is nothing to
            // refetch — the staged files upload after the record exists.
            const articleId = article?.id;
            if (articleId === undefined) return;
            const reloaded = await articlesApi.show(articleId);
            setExistingImages(reloaded.images || []);
            setExistingImageIds(reloaded.image_ids || []);
          }}
        />
      </div>

      {canSeeSource(user) && (
        <div className="review-form__field">
          <label htmlFor="article-source">Source</label>
          <select
            id="article-source"
            value={form.source}
            onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))}
          >
            {SOURCE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {sourceLabel(value)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="review-form__status-row">
        <button
          type="button"
          className={`review-form__status-btn ${form.status === "draft" ? "review-form__status-btn--active" : ""}`}
          onClick={() => setForm((prev) => ({ ...prev, status: "draft" }))}
        >
          Save as Draft
        </button>
        <button
          type="button"
          className={`review-form__status-btn ${form.status === "published" ? "review-form__status-btn--active" : ""}`}
          onClick={() => setForm((prev) => ({ ...prev, status: "published" }))}
        >
          Publish
        </button>
        <button
          type="button"
          className={`review-form__status-btn ${form.status === "archived" ? "review-form__status-btn--active" : ""}`}
          onClick={() => setForm((prev) => ({ ...prev, status: "archived" }))}
        >
          Archive
        </button>
      </div>

      {error && <p className="review-form__error">{error}</p>}

      <div className="review-form__actions">
        <button className="auth-form__submit" type="submit" disabled={submitting || uploadingInline}>
          {submitting ? "Saving..." : isEditing ? "Update Article" : "Create Article"}
        </button>
        {onCancel && (
          <button type="button" className="review-form__cancel" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default ArticleForm;