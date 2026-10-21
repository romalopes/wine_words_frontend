import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  reviewsApi,
  imagesApi,
  categoriesApi,
  winesApi,
  winePackageItemsApi,
} from "../services/api";
import ImageManager from "./ImageManager";
import RichTextEditor from "./RichTextEditor";
import WritingDraftNotice from "./WritingDraftNotice";
import InlineVintageCreateForm from "./InlineVintageCreateForm";
import { useWritingDraft } from "../hooks/useWritingDraft";
import { useAuth } from "../contexts/AuthContext";
import { canSeeSource } from "../constants/roles";
import { SOURCE_OPTIONS, sourceLabel } from "./SourceBadge";
import { uploadInlineImage } from "../services/inlineImages";
import { responseItems } from "../types/common";
import type { ReviewWritePayload } from "../types/api";
import type { Category } from "../types/catalog";
import type { Review } from "../types/review";
import type { Vintage, WineListItem } from "../types/wine";
import { errorMessage } from "../utils/errors";

/**
 * The wine/vintage a review points at. `id` is nullable because an existing
 * review can be saved before its vintage is known, and `year` is the display
 * form — the literal string "NV" stands in for a non-vintage year.
 */
interface PickedVintage {
  id: number | null | undefined;
  year: number | "NV" | null | undefined;
  wineName: string | null | undefined;
}

/**
 * The editable review fields.
 *
 * `score`, `drink_from` and `drink_to` are `number | ""` because a cleared
 * number input reads back as `""`; the submit handler maps `""` to null.
 */
interface ReviewFormState {
  title: string;
  comment: string;
  score: number | "";
  status: string;
  source: string;
  drink_from: number | "";
  drink_to: number | "";
  drink_plus: boolean;
  /**
   * Issue #185 publication deadline. A date-only string (`YYYY-MM-DD`) so the
   * value the browser submits is exactly what the API stores — no timezone
   * shifting. Empty means "let the API choose its default".
   */
  deadline: string;
  category_ids: number[];
  /** Only present when editing — create fixes the vintage from the props. */
  vintage_id?: number | null;
}

/** Fields whose empty input must become `null` rather than a number. */
type NumericField = "score" | "drink_from" | "drink_to";

interface ReviewFormProps {
  /**
   * Identifies the bottle a *new* review is created against. Required by the
   * create paths and unused when editing, so the review detail page — which
   * only ever edits — can omit all three.
   */
  wineSlug?: string | undefined;
  vintageId?: number | undefined;
  vintageYear: number | null;
  wineName?: string | undefined;
  vintageNoVintage?: boolean | undefined;
  review?: Review | null;
  onSaved: (saved?: Review) => void;
  onCancel?: () => void;
  // Package mode: when both are present the review is created through the
  // package item endpoint, which creates it via the ordinary Review path and
  // links it back to the line in the same request.
  packageId?: string | number | null;
  packageItemId?: string | number | null;
  /** Initial values for the form when creating a new review (ignored when editing). */
  initialValues?: Partial<ReviewFormState>;
}

function ReviewForm({
  wineSlug,
  vintageId,
  vintageYear,
  wineName,
  vintageNoVintage,
  review,
  onSaved,
  onCancel,
  packageId,
  packageItemId,
}: ReviewFormProps) {
  const packageMode = packageId != null && packageItemId != null;
  const isEditing = Boolean(review);

  // Auto-generated title: "Review of {Wine} - {Year|NV}" (create only).
  const autoTitle = wineName
    ? `${wineName} ${vintageNoVintage ? "NV" : vintageYear || "NV"}`
    : "";
  const titleEditedRef = useRef(Boolean(review?.title));

  const [form, setForm] = useState<ReviewFormState>(
    review
      ? {
          title: review.title || "",
          comment: review.comment || "",
          score: review.score ?? 80,
          status: review.status || "draft",
          source: review.source || "manual",
          drink_from: review.drink_from ?? "",
          drink_to: review.drink_to ?? "",
          drink_plus: Boolean(review.drink_plus),
          deadline: review.deadline ?? "",
          category_ids: (review.categories || []).map((c) => c.id),
          vintage_id: review.vintage_id ?? null,
        }
      : {
          title: autoTitle,
          comment: "",
          score: 80,
          status: "draft",
          source: "manual",
          drink_from: "",
          drink_to: "",
          drink_plus: false,
          deadline: "",
          category_ids: [],
        },
  );

  // Wine/vintage picker state, shared by edit and create. In create mode a
  // caller may pre-supply the bottle via props; when it does not, we start in
  // the picker so the reviewer searches for an existing wine — the same flow
  // edit uses behind its "Change wine/vintage" button.
  const [changingWine, setChangingWine] = useState(
    isEditing ? false : vintageId == null,
  );
  const [wineQuery, setWineQuery] = useState("");
  // `null` means "no search yet", which the UI distinguishes from "no results".
  const [wineResults, setWineResults] = useState<WineListItem[] | null>(null);
  const [pickedWine, setPickedWine] = useState<WineListItem | null>(null);
  // Slug a *new* review is created against. Seeded from the prop and replaced
  // when the reviewer picks a wine in the search picker, because the create
  // endpoint is addressed by slug rather than by vintage id alone.
  const [newWineSlug, setNewWineSlug] = useState<string | undefined>(wineSlug);
  const [pickedVintage, setPickedVintage] = useState<PickedVintage | null>(
    review
      ? {
          id: review.vintage_id,
          year: review.vintage_year,
          wineName: review.wine_name,
        }
      : vintageId != null
        ? { id: vintageId, year: vintageYear, wineName: wineName ?? null }
        : null,
  );
  // Whether the inline "add a vintage" form is open inside the wine picker.
  const [creatingVintage, setCreatingVintage] = useState(false);

  // Debounced wine search for the picker. Runs whenever the picker is open,
  // in both edit and new-review mode, so the two flows search identically.
  useEffect(() => {
    if (!changingWine) return undefined;
    const q = wineQuery.trim();
    if (q.length < 2) {
      setWineResults(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await winesApi.search(q);
        if (!cancelled) setWineResults(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setWineResults([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wineQuery, changingWine]);

  function pickWine(wine: WineListItem) {
    setPickedWine(wine);
    setNewWineSlug(wine.slug);
    setPickedVintage(null);
  }

  function pickVintage(vintage: Vintage) {
    setPickedVintage({
      id: vintage.id,
      year: vintage.no_vintage ? "NV" : vintage.year,
      wineName: pickedWine?.name || review?.wine_name,
    });
    setForm((prev) => ({ ...prev, vintage_id: vintage.id }));
    setChangingWine(false);
    setWineQuery("");
    setWineResults(null);
  }

  // "Auto-generate name" (mirrors WineForm): while checked, the review title is
  // rebuilt as "{Wine name} {Vintage year|NV}" whenever the picked wine/vintage
  // changes. Unchecking hands the field back to the reviewer.
  const [autoName, setAutoName] = useState(!isEditing);
  const effectiveWineName =
    pickedVintage?.wineName ?? pickedWine?.name ?? wineName ?? "";
  const effectiveYear =
    pickedVintage?.year ?? (vintageNoVintage ? "NV" : vintageYear ?? "NV");
  const generatedTitle = effectiveWineName
    ? `${effectiveWineName} ${effectiveYear}`
    : "";

  useEffect(() => {
    if (!autoName) return;
    setForm((prev) =>
      prev.title === generatedTitle ? prev : { ...prev, title: generatedTitle },
    );
  }, [autoName, generatedTitle]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [uploadingInline, setUploadingInline] = useState(false);
  const writingDraft = useWritingDraft(
    user ? `wine-words:writing:${user.id}:review:${review?.id ?? `new:${packageId ?? "wine"}:${packageItemId ?? wineSlug}:${vintageId ?? ""}`}` : null,
    { title: form.title, comment: form.comment },
  );
  // Locally staged files, uploaded right after the review is saved.
  const [images, setImages] = useState<File[] | null>(null);
  const [existingImages, setExistingImages] = useState<string[]>(
    review?.images || [],
  );
  const [existingImageIds, setExistingImageIds] = useState<Array<number | null>>(
    review?.image_ids || [],
  );
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    async function loadCategories() {
      try {
        // `list` may answer with a bare array or the pagination envelope.
        const allCategories = responseItems(await categoriesApi.list());
        const reviewCategories = allCategories
          .filter((c) => c.for_review)
          // Rows without a review sort order are pushed to the end rather than
          // sorted as 0, so ordered categories keep their positions.
          .sort(
            (a, b) => (a.sort_order_review ?? Infinity) - (b.sort_order_review ?? Infinity),
          );
        setCategories(reviewCategories);
      } catch {
        setCategories([]);
      }
    }
    loadCategories();
  }, []);

  /** Builds the onChange handler for a text/number/checkbox field. */
  function updateField(field: "drink_plus" | NumericField | "title" | "comment" | "status" | "source" | "deadline") {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const target = e.target as HTMLInputElement;
      let value: ReviewFormState[typeof field];
      if (field === "drink_plus") {
        value = target.checked as ReviewFormState["drink_plus"];
      } else if (field === "score" || field === "drink_from" || field === "drink_to") {
        // An emptied number input is "", which the submit handler maps to null.
        value = (target.value === "" ? "" : Number(target.value)) as ReviewFormState[typeof field];
      } else {
        value = target.value as ReviewFormState[typeof field];
      }
      setForm((prev) => ({ ...prev, [field]: value }));
      if (field === "title") titleEditedRef.current = true;
    };
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (uploadingInline) return;
    setSubmitting(true);
    setError(null);

    try {
      // `""` from a cleared numeric input is sent as null, not 0.
      const payload: ReviewWritePayload = {
        ...form,
        score: form.score === "" ? null : form.score,
        published_at:
          form.status === "published" ? new Date().toISOString() : null,
        drink_from: form.drink_from === "" ? null : Number(form.drink_from),
        drink_to: form.drink_to === "" ? null : Number(form.drink_to),
        drink_plus: Boolean(form.drink_plus),
        // Date-only: an empty input means "use the API default / inherited
        // package deadline", so it is omitted rather than sent as null.
        deadline: form.deadline || null,
      };

      if (isEditing && review) {
        if (packageMode) {
          throw new Error(
            "A package review cannot be edited here. Open the review page instead.",
          );
        }
        await reviewsApi.update(review.id, {
          ...payload,
          vintage_id: pickedVintage?.id ?? review.vintage_id,
        });
        if (images && images.length > 0) {
          await imagesApi.upload("review", review.id, images);
        }
        writingDraft.clear();
        onSaved();
      } else if (packageMode) {
        // Package mode is create-only: the backend creates the review through
        // the ordinary Review path and links it to the line atomically.
        const saved = await winePackageItemsApi.createReview(
          packageId,
          packageItemId,
          payload,
        );
        if (images && images.length > 0 && saved?.id) {
          await imagesApi.upload("review", saved.id, images);
        }
        writingDraft.clear();
        onSaved(saved);
      } else {
        // Neither editing nor a package line: this is a brand-new review, which
        // the API addresses by wine slug + vintage. The bottle comes from the
        // picker when the reviewer searched for it (newWineSlug/pickedVintage),
        // or from the props when a caller pre-supplied it (wine/package pages).
        const createSlug = newWineSlug || wineSlug;
        const createVintageId = pickedVintage?.id ?? vintageId;
        if (!createSlug || createVintageId == null) {
          throw new Error(
            "Choose the wine and vintage this review belongs to before saving.",
          );
        }
        const saved = await reviewsApi.create(createSlug, createVintageId, payload);
        if (images && images.length > 0 && saved?.id) {
          await imagesApi.upload("review", saved.id, images);
        }
        writingDraft.clear();
        onSaved(saved);
      }
    } catch (err) {
      setError(errorMessage(err, "Failed to save review"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="review-form" onSubmit={handleSubmit}>
      <WritingDraftNotice draft={writingDraft} onRestore={(fields) => {
        titleEditedRef.current = true;
        setAutoName(false);
        setForm((prev) => ({ ...prev, title: fields.title ?? prev.title, comment: fields.comment ?? prev.comment }));
      }} />
      {(isEditing || (!packageMode && vintageId == null)) && (
        <div className="review-form__field">
          <label>Wine &amp; Vintage</label>
          {!changingWine ? (
            <div className="review-list">
              <div className="review-card">
                <div className="review-card__top">
                  <strong>{pickedVintage?.wineName || wineName || "—"}</strong>
                  <span className="review-card__status">
                    {pickedVintage?.year || vintageYear || "Vintage"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn-action"
                onClick={() => setChangingWine(true)}
              >
                Change wine/vintage
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={wineQuery}
                onChange={(e) => setWineQuery(e.target.value)}
                placeholder="Search for a wine…"
                autoFocus
              />
              {wineResults !== null &&
                wineResults.length > 0 &&
                !pickedWine && (
                  <div className="review-list">
                    {wineResults.map((wine) => (
                      <button
                        key={wine.slug}
                        type="button"
                        className="review-card"
                        onClick={() => pickWine(wine)}
                      >
                        <div className="review-card__top">
                          <strong>{wine.name}</strong>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              {pickedWine && (
                <>
                  <p className="wine-management__empty-state">
                    Reviewing <strong>{pickedWine.name}</strong> — choose a
                    vintage.
                  </p>
                  {!creatingVintage ? (
                    <>
                      <div className="review-list">
                        {(pickedWine.vintages || []).map((vintage) => (
                          <button
                            key={vintage.id}
                            type="button"
                            className="review-card"
                            onClick={() => pickVintage(vintage)}
                          >
                            <div className="review-card__top">
                              <strong>
                                {vintage.no_vintage ? "NV" : vintage.year}
                              </strong>
                            </div>
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="review-form__cancel"
                        onClick={() => setCreatingVintage(true)}
                      >
                        Add a new vintage
                      </button>
                    </>
                  ) : (
                    <InlineVintageCreateForm
                      wine={pickedWine}
                      onCreated={(created) => {
                        pickVintage(created);
                        setCreatingVintage(false);
                      }}
                      onCancel={() => setCreatingVintage(false)}
                    />
                  )}
                  <button
                    type="button"
                    className="review-form__cancel"
                    onClick={() => {
                      setPickedWine(null);
                      setCreatingVintage(false);
                      setWineQuery("");
                      setWineResults(null);
                    }}
                  >
                    Back to wine search
                  </button>
                </>
              )}
              <button
                type="button"
                className="review-form__cancel"
                onClick={() => setChangingWine(false)}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}
      <div className="review-form__metadata-grid">
      <div className="review-form__field review-form__field--wide">
        <label htmlFor="review-title">Title</label>
        <input
          id="review-title"
          type="text"
          required
          value={form.title}
          onChange={updateField("title")}
          placeholder="Give your review a short title"
          readOnly={autoName}
        />
        <label className="review-form__auto-name">
          <input
            type="checkbox"
            checked={autoName}
            onChange={() => setAutoName(!autoName)}
          />
          <span>Auto-generate name</span>
        </label>
      </div>

      <div className="review-form__field review-form__field--wide">
        <label htmlFor="review-score">Score</label>
        <div className="review-form__score-row">
          <input
            id="review-score"
            type="range"
            min={0}
            max={100}
            step={1}
            value={form.score}
            onChange={updateField("score")}
          />
          <output className="review-form__score-value">{form.score}</output>
        </div>
      </div>

      <div className="review-form__field">
        <label htmlFor="review-drink-from">Drink From</label>
        <div className="review-form__score-row">
          <input
            id="review-drink-from"
            type="number"
            min={vintageYear || 1900}
            value={form.drink_from}
            onChange={updateField("drink_from")}
            placeholder={vintageYear ? `e.g. ${vintageYear}` : "e.g. 2026"}
          />
        </div>
      </div>
      <div className="review-form__field">
        <label htmlFor="review-drink-to">Drink To</label>
        <div className="review-form__score-row">
          <input
            id="review-drink-to"
            type="number"
            min={form.drink_from === "" ? undefined : form.drink_from}
            value={form.drink_to}
            onChange={updateField("drink_to")}
            placeholder="e.g. 2035"
          />
        </div>
      </div>
      <div className="review-form__field review-form__field--wide review-form__drink-plus">
        <input
          id="review-drink-plus"
          type="checkbox"
          checked={form.drink_plus}
          onChange={updateField("drink_plus")}
        />
        <label htmlFor="review-drink-plus" style={{ margin: 0 }}>
          Drinking window can be extended (+)
        </label>
      </div>
      <div className="review-form__field review-form__field--wide">
        <label htmlFor="review-deadline">Deadline</label>
        <input
          id="review-deadline"
          type="date"
          value={form.deadline}
          onChange={updateField("deadline")}
        />
        <p className="review-card__comment">
          Leave blank to inherit the wine package&apos;s deadline, or default to
          14 days from today. Published and archived reviews keep the date but
          are never flagged overdue.
        </p>
      </div>
      <div className="review-form__field review-form__field--wide">
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
      </div>
      <div className="review-form__field">
        <span className="image-manager__label">Comment</span>
        <RichTextEditor
          label="Review comment"
          onUploadingChange={setUploadingInline}
          uploadImage={review ? (file) => uploadInlineImage("review", review.id, file, (uploaded) => {
            const withUrls = uploaded.filter((image) => Boolean(image.url));
            setExistingImages(withUrls.map((image) => image.url!));
            setExistingImageIds(withUrls.map((image) => image.id));
          }) : undefined}
          value={form.comment}
          onChange={(html) => setForm((prev) => ({ ...prev, comment: html }))}
          placeholder="What did you think of this vintage?"
        />
      </div>

      <div className="review-form__field">
        <span className="image-manager__label">
          Images (click + to add, × to remove)
        </span>
        <ImageManager
          imageableType="review"
          images={existingImages}
          imageIds={existingImageIds}
          imageableId={isEditing && review ? review.id : null}
          onFilesChange={(files) => setImages(files)}
          onImagesChange={async () => {
            if (isEditing && review) {
              const reloaded = await reviewsApi.show(review.id);
              setExistingImages(reloaded.images || []);
              setExistingImageIds(reloaded.image_ids || []);
            }
          }}
        />
      </div>

      {canSeeSource(user) && (
        <div className="review-form__field">
          <label htmlFor="review-source">Source</label>
          <select
            id="review-source"
            value={form.source}
            onChange={updateField("source")}
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
        <button
          className="auth-form__submit"
          type="submit"
          disabled={submitting || uploadingInline}
        >
          {submitting
            ? "Saving..."
            : isEditing
              ? "Update Review"
              : "Submit Review"}
        </button>
        {onCancel && (
          <button
            type="button"
            className="review-form__cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default ReviewForm;
