import { useState, useEffect, useRef, useCallback } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import PageHero from "./PageHero";
import {
  winesApi,
  tasteParametersApi,
  imagesApi,
  categoriesApi,
  wineProfilesApi,
} from "../services/api";
import ImageManager from "./ImageManager";
import ProducerSearch from "./ProducerSearch";
import GrapeSearch, { type SelectedGrape } from "./GrapeSearch";
import RegionSearch, { type SelectedRegion } from "./RegionSearch";
import TasteParameterSliders from "./TasteParameterSliders";
import {
  VOLUMES,
  DEFAULT_VOLUME,
  DEFAULT_COLOR,
  DEFAULT_CLOSURE,
  DEFAULT_ALCOHOL_PERCENTAGE,
} from "../data/wineVolumes";
import { errorMessage } from "../utils/errors";
import type { Category, TasteParameter } from "../types/catalog";
import type { VintageWrite, WineTasteParameter } from "../types/wine";
import type { WineProfileSearchResponse } from "../types/api";
import type { UserWineProfile } from "../types/user";

/**
 * One row of the vintages editor. The API stores `year`/`price` as numbers and
 * `id` only once persisted, but the inputs are text boxes, so the form holds
 * them as strings until submit and converts there.
 */
interface VintageFormRow {
  id: number | null
  year: string
  prompt: string
  price: string
  no_vintage: boolean
}

/**
 * A taste score being edited. `id` is the join-table record id, which is null
 * until the wine exists — a brand new wine has no persisted scores yet.
 * `Omit`/`&` rather than `extends` because the persisted id is nullable here.
 */
type TasteScoreRow = Omit<WineTasteParameter, "id"> & { id: number | null };

const INITIAL_VINTAGE: VintageFormRow = {
  id: null,
  year: "",
  prompt: "",
  price: "",
  no_vintage: false,
};

/** The text fields this form manages. Numbers stay as strings while typing. */
interface WineFormData {
  id: number | null
  name: string
  color: string
  closure: string
  alcohol_percentage: string
  volume_ml: string
  prompt: string
  producer_id: string
  producer_name: string
  designation_name: string
  wine_profile_id: string | null
  category_ids: number[]
  fortified: boolean
  sparkling: boolean
}

function WineForm() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(slug);

  const [formData, setFormData] = useState<WineFormData>({
    id: null,
    name: "",
    color: DEFAULT_COLOR,
    closure: DEFAULT_CLOSURE,
    alcohol_percentage: String(DEFAULT_ALCOHOL_PERCENTAGE),
    volume_ml: String(DEFAULT_VOLUME),
    prompt: "",
    producer_id: "",
    producer_name: "",
    designation_name: "",
    wine_profile_id: null,
    category_ids: [],
    fortified: false,
    sparkling: false,
  });

  const [selectedGrapes, setSelectedGrapes] = useState<SelectedGrape[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<SelectedRegion[]>([]);
  const [autoName, setAutoName] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] =
    useState<WineProfileSearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performProfileSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults(null);
      setSearched(false);
      setSearchError(null);
      return;
    }

    try {
      setSearching(true);
      setSearchError(null);
      const results = await wineProfilesApi.search(trimmed);
      setSearchResults(results);
      setSearched(true);
    } catch (err) {
      setSearchError(errorMessage(err, "Profile search failed"));
      setSearchResults(null);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleProfileSearchChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setSearchQuery(value);
    setFormData((previous) => ({ ...previous, wine_profile_id: null }));
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => performProfileSearch(value), 300);
  }

  function handleProfileSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    void performProfileSearch(searchQuery);
  }

  function selectWineProfile(profile: UserWineProfile) {
    if (profile.id == null) {
      setSearchError("This wine profile cannot be selected because its ID is missing.");
      return;
    }
    setFormData((previous) => ({
      ...previous,
      wine_profile_id: String(profile.id),
    }));
    if (profile.parameters) {
      setTasteScores((previous) =>
        previous.map((score) => ({
          ...score,
          score: profile.parameters?.[score.taste_parameter_slug] ?? score.score,
        })),
      );
      setTasteParamsTouched(true);
    }
    setSearchQuery(profile.name ?? profile.slug);
    setSearchResults(null);
    setSearched(false);
    setSearchError(null);
  }

  function clearWineProfile() {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setFormData((previous) => ({ ...previous, wine_profile_id: null }));
    setSearchQuery("");
    setSearchResults(null);
    setSearched(false);
    setSearchError(null);
  }

  const [wineCategories, setWineCategories] = useState<Category[]>([]);
  const [vintages, setVintages] = useState<VintageFormRow[]>([]);
  const [tasteParams, setTasteParams] = useState<TasteParameter[]>([]);
  const [tasteScores, setTasteScores] = useState<TasteScoreRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [tasteParamsTouched, setTasteParamsTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<File[] | null>(null);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [existingImageIds, setExistingImageIds] = useState<number[]>([]);
  useEffect(() => {
    async function initFormData() {
      try {
        setLoading(true);
        // 1. Load taste parameters and wine categories (for this form)
        const [globalParams, wineCats] = await Promise.all([
          tasteParametersApi.list(),
          categoriesApi.list("wine"),
        ]);
        const paramsArray = Array.isArray(globalParams) ? globalParams : [];
        setTasteParams(paramsArray);
        setWineCategories(Array.isArray(wineCats) ? wineCats : []);

        // Set baseline defaults
        let initialScores: TasteScoreRow[] = paramsArray.map((p) => ({
          id: null, // join table record id
          taste_parameter_id: p.id,
          taste_parameter_slug: p.slug,
          score: 3,
        }));

        // 2. If editing, load the wine and merge its existing scores
        if (isEditing) {
          // `slug` is only present when editing, which is what isEditing means.
          const wineData = await winesApi.show(slug ?? "");

          setExistingImages(wineData.images || []);
          setExistingImageIds(wineData.image_ids || []);

          setFormData({
            id: wineData.id || null,
            name: wineData.name || "",
            color: wineData.color || DEFAULT_COLOR,
            closure: wineData.closure || DEFAULT_CLOSURE,
            alcohol_percentage:
              wineData.alcohol_percentage != null
                ? String(wineData.alcohol_percentage)
                : String(DEFAULT_ALCOHOL_PERCENTAGE),
            volume_ml:
              wineData.volume_ml != null
                ? String(wineData.volume_ml)
                : String(DEFAULT_VOLUME),
            prompt: wineData.prompt || "",
            producer_id: wineData.producer?.id
              ? String(wineData.producer.id)
              : "",
            producer_name: wineData.producer?.name || "",
            designation_name: wineData.designation_name || "",
            wine_profile_id:
              wineData.wine_profile_id == null
                ? null
                : String(wineData.wine_profile_id),
            category_ids: (wineData.categories ?? []).map((c) => c.id),
            sparkling: Boolean(wineData.sparkling),
            fortified: Boolean(wineData.fortified),
          });
          setSearchQuery(wineData.wine_profile?.name ?? "");

          setSelectedGrapes(wineData.grapes || []);
          setAutoName(false);
          setSelectedRegions(wineData.regions || []);

          setVintages(
            (wineData.vintages ?? []).map((v) => ({
              id: v.id,
              year: v.year == null ? "" : String(v.year),
              prompt: v.prompt || "",
              price: v.price == null ? "" : String(v.price),
              no_vintage: Boolean(v.no_vintage),
            })),
          );

          const savedScores = wineData.parameters;
          if (savedScores && savedScores.length > 0) {
            initialScores = initialScores.map((scoreObj) => {
              const matchingParam = savedScores.find(
                (wp) => wp.taste_parameter_id === scoreObj.taste_parameter_id,
              );
              if (matchingParam) {
                return {
                  ...scoreObj,
                  id: matchingParam.id,
                  score: matchingParam.score,
                };
              }
              return scoreObj;
            });
          }
        }

        setTasteScores(initialScores);
      } catch (err) {
        setError(errorMessage(err, "Failed to initialize form options"));
      } finally {
        setLoading(false);
      }
    }

    initFormData();
  }, [slug, isEditing]);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!autoName) return;
    const producer = (formData.producer_name || "").trim();
    const designation = (formData.designation_name || "").trim();
    const grape = (selectedGrapes[0] || {}).name;
    const grapeName = grape ? grape.trim() : "";
    const parts = [producer, designation, grapeName].filter(Boolean);
    const computed = parts.join(" ");
    setFormData((prev) => ({ ...prev, name: computed }));
  }, [
    formData.producer_name,
    formData.designation_name,
    selectedGrapes,
    autoName,
  ]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    if (e.target.name === "name" && autoName) setAutoName(false);
    const target = e.target;
    // A checkbox reports `checked`; selects and text inputs report `value`.
    const value =
      target instanceof HTMLInputElement && target.type === "checkbox"
        ? target.checked
        : target.value;
    setFormData((prev) => ({ ...prev, [target.name]: value }));
  }

  function handleVintageChange<K extends keyof VintageFormRow>(
    index: number,
    field: K,
    value: VintageFormRow[K],
  ) {
    setVintages((prev) => {
      const updated = [...prev];
      const row = updated[index];
      if (row) updated[index] = { ...row, [field]: value };
      return updated;
    });
  }

  function handleTasteChange(index: number, value: string) {
    setTasteParamsTouched(true);
    setTasteScores((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], score: Number(value) };
      }
      return updated;
    });
  }

  function addVintage() {
    setVintages((prev) => [...prev, { ...INITIAL_VINTAGE }]);
  }

  function removeVintage(index: number) {
    setVintages((prev) => prev.filter((_, i) => i !== index));
  }

  function handleProducerChange(id: number | string, name: string) {
    setFormData((prev) => ({
      ...prev,
      producer_id: id ? String(id) : "",
      producer_name: name || "",
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);

      if (!formData.producer_id) {
        throw new Error("Please select or create a producer");
      }

      const wineTasteParametersAttributes = tasteScores.map((ts) => ({
        id: ts.id || null,
        taste_parameter_id: ts.taste_parameter_id,
        taste_parameter_slug: ts.taste_parameter_slug,
        score: ts.score,
      }));

      // Untouched sliders do not submit: when the server receives no taste
      // attributes it auto-fills the closest profile. An edit or any touched
      // slider always submits the current scores.
      const wineTasteParameters = isEditing || tasteParamsTouched
        ? wineTasteParametersAttributes
        : [];

      const payload = {
        name: formData.name,
        color: formData.color,
        closure: formData.closure || null,
        alcohol_percentage: formData.alcohol_percentage
          ? parseFloat(formData.alcohol_percentage)
          : null,
        volume_ml: formData.volume_ml ? parseInt(formData.volume_ml, 10) : null,
        prompt: formData.prompt || null,
        producer_id: formData.producer_id
          ? parseInt(formData.producer_id, 10)
          : null,
        wine_profile_id: formData.wine_profile_id
          ? parseInt(formData.wine_profile_id, 10)
          : null,
        category_ids: formData.category_ids || [],
        sparkling: Boolean(formData.sparkling),
        fortified: Boolean(formData.fortified),
        grape_ids: selectedGrapes.map((g) => g.id),
        wine_taste_parameters_attributes: wineTasteParameters,
        region_ids: selectedRegions.map((r) => r.id),
        vintages_attributes: vintages.map((v): VintageWrite => {
          const attr: VintageWrite = {
            year: parseInt(v.year, 10),
            prompt: v.prompt || null,
            price:
              v.price === "" || v.price == null ? null : parseFloat(v.price),
            no_vintage: Boolean(v.no_vintage),
          };
          if (v.id) attr.id = v.id;
          return attr;
        }),
      };

      // `isEditing` is `Boolean(slug)`, but that does not narrow `slug` itself,
      // so guard on the value here rather than non-null asserting.
      if (isEditing && slug) {
        await winesApi.update(slug, payload);
        if (images && images.length > 0) {
          await imagesApi.upload("wine", slug, images);
        }
        navigate(`/wines/${slug}`, { replace: true });
      } else {
        const result = await winesApi.create(payload);
        if (images && images.length > 0) {
          await imagesApi.upload("wine", result.slug, images);
        }
        navigate(`/wines/${result.slug}`, { replace: true });
      }
    } catch (err) {
      setError(errorMessage(err, "Failed to save wine"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="wine-app">
        <p className="wine-management__loading">Loading…</p>
      </div>
    );
  }

  return (
    <div className="wine-app">
      <Link
        to={isEditing ? `/wines/${slug}` : "/wines"}
        className="wine-detail__back"
      >
        &larr; Back
      </Link>
      <PageHero
        kicker="Cellar"
        title={isEditing ? "Edit Wine" : "Add New Wine"}
      />
      {error && <p className="auth-form__error">{error}</p>}
      <form onSubmit={handleSubmit} className="wine-form wine-catalog-form">
        <div className="wine-form__fields wine-catalog-form__fields">
          <div className="auth-form__field wine-catalog-form__field--wide">
            <ProducerSearch
              value={formData.producer_name}
              onChange={handleProducerChange}
            />
          </div>
          <label className="auth-form__field">
            <span>Designation Name</span>
            <input
              type="text"
              name="designation_name"
              value={formData.designation_name}
              onChange={handleChange}
              placeholder="e.g. Reserve"
            />
          </label>
          <div className="auth-form__field">
            <GrapeSearch
              selected={selectedGrapes}
              onChange={setSelectedGrapes}
            />
          </div>
          <label className="auth-form__field wine-catalog-form__field--wide">
            <span>Name *</span>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              readOnly={autoName}
            />
          </label>
          <label className="auth-form__field wine-catalog-form__auto-name">
            <input
              type="checkbox"
              checked={autoName}
              onChange={() => setAutoName(autoName ? false : true)}
            />
            <span>Auto-generate name</span>
          </label>
          <div className="auth-form__field">
            <RegionSearch
              selected={selectedRegions}
              onChange={setSelectedRegions}
            />
          </div>
          <div className="auth-form__field wine-catalog-form__field--wide wine-profile-search">
            <span>Wine profile</span>
            <div className="wine-profile-search__input-row">
              <input
                type="search"
                value={searchQuery}
                onChange={handleProfileSearchChange}
                onKeyDown={handleProfileSearchKeyDown}
                placeholder="Search profiles by name, grape, or region…"
                autoComplete="off"
                aria-label="Wine profile"
              />
              {(searchQuery || formData.wine_profile_id) && (
                <button
                  type="button"
                  className="wine-profile-search__clear"
                  onClick={clearWineProfile}
                >
                  Clear
                </button>
              )}
            </div>
            {formData.wine_profile_id && (
              <p className="wine-profile-search__selected">
                Selected profile: {searchQuery}
              </p>
            )}
            {searching && (
              <p className="wine-management__loading">Searching profiles…</p>
            )}
            {searchError && <p className="auth-form__error">{searchError}</p>}
            {!searching && searched && searchResults && (
              <div className="wine-profile-search__results">
                {searchResults.wine_profiles.length > 0 ? (
                  searchResults.wine_profiles.map((profile) => (
                    <button
                      type="button"
                      className="wine-profile-search__result"
                      key={profile.id ?? profile.slug}
                      onClick={() => selectWineProfile(profile)}
                    >
                      <strong>{profile.name ?? profile.slug}</strong>
                      {profile.color && <span>{profile.color}</span>}
                    </button>
                  ))
                ) : (
                  <p className="wine-profile-search__empty">
                    No wine profiles found.
                  </p>
                )}
              </div>
            )}
          </div>
          <label className="auth-form__field auth-form__field--checkbox">
            <input
              type="checkbox"
              name="sparkling"
              checked={formData.sparkling}
              onChange={handleChange}
            />
            <span>Sparkling ✨</span>
          </label>
          <label className="auth-form__field auth-form__field--checkbox">
            <input
              type="checkbox"
              name="fortified"
              checked={formData.fortified}
              onChange={handleChange}
            />
            <span>Fortified 🍷</span>
          </label>
          <div className="auth-form__field wine-catalog-form__field--wide">
            <span>Categories</span>
            <div className="category-checkboxes">
              {wineCategories.map((cat) => (
                <label key={cat.id} className="category-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.category_ids.includes(cat.id)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormData((prev) => ({
                        ...prev,
                        category_ids: checked
                          ? [...prev.category_ids, cat.id]
                          : prev.category_ids.filter((id) => id !== cat.id),
                      }));
                    }}
                  />
                  {cat.name}
                </label>
              ))}
            </div>
          </div>
          <label className="auth-form__field">
            <span>Colour * </span>
            <select
              name="color"
              value={formData.color}
              onChange={handleChange}
              required
            >
              <option value="">Select colour…</option>
              <option value="Red">Red</option>
              <option value="White">White</option>
              <option value="Rosé">Rosé</option>
              <option value="Orange">Orange</option>
              <option value="Dessert">Dessert</option>
            </select>
          </label>
          <label className="auth-form__field">
            <span>Closure *</span>
            <select
              name="closure"
              value={formData.closure}
              onChange={handleChange}
              required
            >
              <option value="">Select closure…</option>
              <option value="Cork">Cork</option>
              <option value="Screw cap">Screw cap</option>
              <option value="Diam">Diam</option>
              <option value="Crownseal">Crownseal</option>
              <option value="Synthetic">Synthetic</option>
              <option value="Glass Stopper">Glass Stopper</option>
              <option value="Nomacorc PlantCorc">Nomacorc PlantCorc</option>
              <option value="Agglomerate">Agglomerate</option>
            </select>
          </label>
          <div className="wine-form__row wine-catalog-form__field--wide">
            <label className="auth-form__field wine-form__row-item">
              <span>Alcohol % *</span>
              <input
                type="number"
                name="alcohol_percentage"
                value={formData.alcohol_percentage}
                onChange={handleChange}
                step="0.1"
                min="0"
                max="25"
                placeholder="e.g. 13.5"
                required
              />
            </label>
            <label className="auth-form__field wine-form__row-item">
              <span>Volume (ml) *</span>
              <select
                name="volume_ml"
                value={formData.volume_ml || ""}
                onChange={handleChange}
                required
              >
                {VOLUMES.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="auth-form__field wine-catalog-form__field--wide">
            <span>Prompt (optional)</span>
            <textarea
              name="prompt"
              value={formData.prompt}
              onChange={handleChange}
              rows={3}
              placeholder="Description or notes about this wine"
            />
          </label>
        </div>

        <TasteParameterSliders
          parameters={tasteParams}
          getScore={(_, index) => tasteScores[index]?.score ?? 3}
          onScoreChange={(_, index, score) => handleTasteChange(index, String(score))}
        />

        <div className="wine-form__vintages">
          <div className="wine-form__vintages-header">
            <h2>Vintages</h2>
            <button
              type="button"
              className="wine-form__add-vintage"
              onClick={addVintage}
            >
              + Add Vintage
            </button>
          </div>
          {vintages.length === 0 && (
            <p className="wine-management__empty-state">
              No vintages added yet. Click "+ Add Vintage" to add one.
            </p>
          )}
          {vintages.map((vintage, index) => (
            <div key={index} className="wine-form__vintage-row">
              <label className="auth-form__field wine-form__vintage-year">
                <span>Year *</span>
                <input
                  type="number"
                  value={vintage.year}
                  onChange={(e) =>
                    handleVintageChange(index, "year", e.target.value)
                  }
                  min={1900}
                  max={new Date().getFullYear() + 5}
                  required
                  placeholder="e.g. 2020"
                />
              </label>
              <label className="auth-form__field">
                <span>Price</span>
                <input
                  type="number"
                  value={vintage.price}
                  onChange={(e) =>
                    handleVintageChange(index, "price", e.target.value)
                  }
                  min={0}
                  step={0.01}
                  placeholder="e.g. 89.50"
                />
              </label>
              <label
                className="auth-form__field"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(vintage.no_vintage)}
                  onChange={(e) =>
                    handleVintageChange(index, "no_vintage", e.target.checked)
                  }
                />
                <span>NV</span>
              </label>
              <label className="auth-form__field wine-form__vintage-prompt">
                <span>Prompt</span>
                <input
                  type="text"
                  value={vintage.prompt}
                  onChange={(e) =>
                    handleVintageChange(index, "prompt", e.target.value)
                  }
                  placeholder="Tasting notes for this vintage"
                />
              </label>
              <button
                type="button"
                className="wine-form__remove-vintage"
                onClick={() => removeVintage(index)}
                title="Remove vintage"
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        <div className="image-manager">
          <span className="image-manager__label">
            Images (click + to add, × to remove)
          </span>
          <ImageManager
            imageableType="wine"
            images={existingImages}
            imageIds={existingImageIds}
            imageableId={isEditing ? slug : null}
            onFilesChange={(files) => setImages(files)}
            onImagesChange={async () => {
              if (slug) {
                const reloaded = await winesApi.show(slug);
                setExistingImages(reloaded.images || []);
                setExistingImageIds(reloaded.image_ids || []);
              }
            }}
          />
        </div>

        <div className="wine-form__actions">
          <button
            type="submit"
            className="auth-form__submit"
            disabled={submitting}
          >
            {submitting ? "Saving…" : isEditing ? "Update Wine" : "Create Wine"}
          </button>
          <Link
            to={isEditing ? `/wines/${slug}` : "/wines"}
            className="wine-form__cancel"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export default WineForm;
