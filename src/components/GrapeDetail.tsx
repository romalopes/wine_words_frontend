import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import DetailHero from "./DetailHero";
import { grapesApi, winesApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import {
  isAdmin,
  canManageGrapes,
  canManageWinesRole,
} from "../constants/roles";
import WineTable from "./WineTable";
import Pagination from "./Pagination";
import { errorMessage } from "../utils/errors";
import usePagedList from "../hooks/usePagedList";
import type { GrapeDetail as GrapeDetailData } from "../types/catalog";
import type { WineListItem } from "../types/wine";

/** The editable subset of a grape, seeded blank and refilled on every load. */
interface GrapeForm {
  name: string;
  color: string;
  origin_country: string;
  main_regions: string[];
  synonyms: string[];
  is_blending_grape: boolean;
  notes: string[];
  serving: string;
  relevance: string;
}

const emptyForm: GrapeForm = {
  name: "",
  color: "",
  origin_country: "",
  main_regions: [],
  synonyms: [],
  is_blending_grape: false,
  notes: [],
  serving: "",
  relevance: "",
};

const COLOR_OPTIONS = [
  { value: "red", label: "Red" },
  { value: "white", label: "White" },
  { value: "rosé", label: "Rosé" },
  { value: "orange", label: "Orange" },
] as const;

/** The three list-valued fields, each managed by an `ArrayFieldInput`. */
type GrapeListField = "main_regions" | "synonyms" | "notes";

/** Props for the tag-list editor shared by the three array fields. */
interface ArrayFieldInputProps {
  label: string;
  items: string[];
  newValue: string;
  setNewValue: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  placeholder?: string;
}

function GrapeDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [grape, setGrape] = useState<GrapeDetailData | null>(null);
  const [form, setForm] = useState<GrapeForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newRegion, setNewRegion] = useState("");
  const [newSynonym, setNewSynonym] = useState("");
  const [newNote, setNewNote] = useState("");

  const isWineManager = isAdmin(user) || canManageGrapes(user);
  // Admins, Reviewers and Editors may link wines to this grape.
  const canLinkWines = canManageWinesRole(user);

  // Inline wine search for linking wines to this grape.
  const [wineQuery, setWineQuery] = useState("");
  const [wineResults, setWineResults] = useState<WineListItem[] | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const loadGrape = useCallback(async () => {
    if (!slug) return;
    try {
      setLoading(true);
      const data = await grapesApi.show(slug);
      setGrape(data);
      setForm({
        name: data.name || "",
        color: data.color || "",
        origin_country: data.origin_country || "",
        main_regions: data.main_regions || [],
        synonyms: data.synonyms || [],
        is_blending_grape: !!data.is_blending_grape,
        notes: data.notes || [],
        serving: data.serving || "",
        relevance: data.relevance != null ? String(data.relevance) : "",
      });
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load grape"));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadGrape();
  }, [loadGrape]);

  // Debounced wine search for the linking UI.
  useEffect(() => {
    if (!canLinkWines) return undefined;
    const query = wineQuery.trim();
    if (query.length < 2) {
      setWineResults(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await winesApi.search(query);
        if (!cancelled) setWineResults(results.slice(0, 8));
      } catch {
        if (!cancelled) setWineResults([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wineQuery, canLinkWines]);

  async function handleLinkWine(wine: WineListItem) {
    if (!grape || !slug) return;
    if (!window.confirm(`Add "${wine.name}" to "${grape.name}"?`)) return;
    setLinking(true);
    setLinkError(null);
    try {
      await grapesApi.linkWine(slug, wine.slug);
      await loadGrape();
    } catch (err) {
      setLinkError(errorMessage(err, "Failed to link wine"));
    } finally {
      setLinking(false);
    }
  }

  // Generic over the key so the value type follows the field: `GrapeForm[K]`
  // ties `updateField("name", "…")` to `string` and `("notes", […])` to
  // `string[]`, without needing overloads.
  function updateField<K extends keyof GrapeForm>(
    field: K,
    value: GrapeForm[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addArrayField(
    field: GrapeListField,
    value: string,
    setter: (value: string) => void,
  ) {
    if (!value.trim()) return;
    if (form[field].includes(value.trim())) return;
    updateField(field, [...form[field], value.trim()]);
    setter("");
  }

  function removeArrayField(field: GrapeListField, index: number) {
    updateField(
      field,
      form[field].filter((_, i) => i !== index),
    );
  }
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!slug) return;
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        relevance: form.relevance === "" ? null : parseInt(form.relevance, 10),
      };
      await grapesApi.update(slug, payload);
      setNotice(`Grape "${payload.name}" updated.`);
      setIsEditing(false);
      await loadGrape();
    } catch (err) {
      setError(errorMessage(err, "Failed to save grape"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!grape || !slug) return;
    if (!window.confirm(`Delete grape "${grape.name}"? This cannot be undone.`))
      return;
    setError(null);
    setNotice(null);
    try {
      await grapesApi.remove(slug);
      navigate("/grapes", {
        state: { notice: `Grape "${grape.name}" deleted.` },
      });
    } catch (err) {
      setError(errorMessage(err, "Failed to delete grape"));
    }
  }

  // Paginated wines for this grape
  const wines = usePagedList<WineListItem>({
    fetcher: (params) => winesApi.list({ ...params, grape_id: grape?.id }),
    enabled: Boolean(grape?.id),
    paramKey: "wine_page",
    perPage: 20,
  });

  if (loading) return <p className="loading">Loading grape…</p>;
  if (!grape) return <p className="empty">Grape not found.</p>;

  return (
    <div className="wine-app reference-detail">
      <Link to="/grapes" className="wine-detail__back">
        &larr; Back to grapes
      </Link>

      <DetailHero
        kicker="Grape reference"
        title={grape.name}
        badge={
          grape.color ? { label: grape.color, tone: grape.color } : undefined
        }
        intro="Explore this grape’s character, origins, aliases, and associated wines."
        actions={
          isWineManager && !isEditing ? (
            <button
              type="button"
              className="auth-form__submit"
              onClick={() => setIsEditing(true)}
            >
              Edit Grape
            </button>
          ) : undefined
        }
      />

      {error && <div className="flash flash--alert">{error}</div>}
      {notice && <div className="flash flash--notice">{notice}</div>}

      {isEditing ? (
        <section className="grape-form-section">
          <h2>Edit Grape</h2>
          <form onSubmit={handleSubmit} className="grape-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="grape-name">Name *</label>
                <input
                  id="grape-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="e.g. Cabernet Sauvignon"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="grape-color">Color</label>
                <select
                  id="grape-color"
                  value={form.color}
                  onChange={(e) => updateField("color", e.target.value)}
                >
                  <option value="">Select color...</option>
                  {COLOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="grape-origin">Origin Country</label>
                <input
                  id="grape-origin"
                  type="text"
                  value={form.origin_country}
                  onChange={(e) =>
                    updateField("origin_country", e.target.value)
                  }
                  placeholder="e.g. France"
                />
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.is_blending_grape}
                  onChange={(e) =>
                    updateField("is_blending_grape", e.target.checked)
                  }
                />
                Blending grape
              </label>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="grape-relevance">Relevance</label>
                <input
                  id="grape-relevance"
                  type="number"
                  value={form.relevance}
                  onChange={(e) => updateField("relevance", e.target.value)}
                  placeholder="e.g. 100"
                />
              </div>
            </div>
            <ArrayFieldInput
              label="Main Regions"
              items={form.main_regions}
              newValue={newRegion}
              setNewValue={setNewRegion}
              onAdd={() =>
                addArrayField("main_regions", newRegion, setNewRegion)
              }
              onRemove={(idx) => removeArrayField("main_regions", idx)}
              placeholder="Add a region and press Enter"
            />

            <ArrayFieldInput
              label="Synonyms"
              items={form.synonyms}
              newValue={newSynonym}
              setNewValue={setNewSynonym}
              onAdd={() => addArrayField("synonyms", newSynonym, setNewSynonym)}
              onRemove={(idx) => removeArrayField("synonyms", idx)}
              placeholder="Add a synonym and press Enter"
            />

            <ArrayFieldInput
              label="Notes"
              items={form.notes}
              newValue={newNote}
              setNewValue={setNewNote}
              onAdd={() => addArrayField("notes", newNote, setNewNote)}
              onRemove={(idx) => removeArrayField("notes", idx)}
              placeholder="Add a tasting note and press Enter"
            />

            <div className="form-group">
              <label htmlFor="grape-serving">Serving Suggestions</label>
              <textarea
                id="grape-serving"
                value={form.serving}
                onChange={(e) => updateField("serving", e.target.value)}
                placeholder="Food pairing suggestions..."
                rows={3}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Update Grape"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-action btn-action--delete"
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </form>
        </section>
      ) : (
        <div className="reference-detail__layout">
          <div className="reference-detail__main">
            {grape.notes?.length > 0 && (
              <section className="reference-detail__card">
                <p className="wine-profile-detail__eyebrow">Tasting notes</p>
                <h2>What to expect</h2>
                <div
                  className="wine-profile-detail__chips"
                  aria-label="Tasting notes"
                >
                  {grape.notes.map((note, index) => (
                    <span
                      key={`${note}-${index}`}
                      className="wine-profile-detail__chip wine-profile-detail__chip--note"
                    >
                      {note}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {grape.serving && (
              <section className="wine-profile-detail__serving">
                <div
                  className="wine-profile-detail__serving-icon"
                  aria-hidden="true"
                >
                  ✦
                </div>
                <div>
                  <p className="wine-profile-detail__eyebrow">
                    Serving suggestion
                  </p>
                  <p>{grape.serving}</p>
                </div>
              </section>
            )}

            {isWineManager && (
              <section className="reference-detail__card">
                <p className="wine-profile-detail__eyebrow">Catalogue tools</p>
                <h2>Link a wine</h2>
                <div className="review-form__field">
                  <label htmlFor="grape-wine-search">
                    Search wines by name to add them to {grape.name}
                  </label>
                  <input
                    id="grape-wine-search"
                    type="text"
                    value={wineQuery}
                    onChange={(e) => setWineQuery(e.target.value)}
                    placeholder="Search wines by name…"
                  />
                </div>
                {linkError && <p className="review-form__error">{linkError}</p>}
                {wineResults != null &&
                  (wineResults.length === 0 ? (
                    <p className="wine-management__empty-state">
                      No matching wines.
                    </p>
                  ) : (
                    <ul
                      className="wine-list"
                      style={{
                        display: "grid",
                        gap: 6,
                        listStyle: "none",
                        padding: 0,
                      }}
                    >
                      {wineResults.map((wine) => {
                        const linkedHere = wine.grapes?.some(
                          (g) => String(g.id) === String(grape.id),
                        );
                        return (
                          <li
                            key={wine.slug}
                            className="reference-detail__search-result"
                          >
                            <strong>{wine.name}</strong>
                            {linkedHere ? (
                              <span
                                style={{ color: "#2e7d43", fontWeight: 700 }}
                              >
                                Linked here ✓
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="review-form__status-btn"
                                disabled={linking}
                                onClick={() => handleLinkWine(wine)}
                              >
                                Link
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ))}
              </section>
            )}

            <section className="reference-detail__card reference-detail__card--wide">
              <p className="wine-profile-detail__eyebrow">
                Associated catalogue
              </p>
              <h2>Wines{!wines.loading && ` (${wines.totalCount})`}</h2>
              {wines.loading ? (
                <p className="wine-management__loading">Loading wines…</p>
              ) : wines.items.length > 0 ? (
                <>
                  <WineTable
                    wines={wines.items}
                    onDeleted={() => {
                      grapesApi
                        .show(grape.id)
                        .then(setGrape)
                        .catch(() => {});
                      wines.reload();
                    }}
                    linkContext={{
                      type: "grape",
                      id: grape.id,
                      name: grape.name,
                    }}
                    onWineLinked={() => wines.reload()}
                  />
                  <Pagination
                    page={wines.page}
                    totalPages={wines.totalPages}
                    totalCount={wines.totalCount}
                    onPageChange={wines.setPage}
                  />
                </>
              ) : (
                <p className="empty">
                  No wines are associated with this grape yet.
                </p>
              )}
            </section>
          </div>

          <aside
            className="reference-detail__sidebar"
            aria-label="Grape information"
          >
            <div className="reference-detail__sidebar-group">
              <p className="wine-profile-detail__eyebrow">At a glance</p>
              <dl className="reference-detail__facts">
                <div>
                  <dt>Origin</dt>
                  <dd>{grape.origin_country || "Not specified"}</dd>
                </div>
                <div>
                  <dt>Blending grape</dt>
                  <dd>{grape.is_blending_grape ? "Yes" : "No"}</dd>
                </div>
                {grape.relevance != null && (
                  <div>
                    <dt>Relevance</dt>
                    <dd>{grape.relevance}</dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="wine-profile-detail__origin-divider" />
            <div className="reference-detail__sidebar-group">
              <p className="wine-profile-detail__eyebrow">Main regions</p>

              {grape.regions?.length + grape.main_regions?.length > 0 && (
                <div className="wine-profile-detail__chips">
                  {grape.main_regions.map((region, index) => (
                    <span
                      key={`${region}-${index}`}
                      className="wine-profile-detail__chip wine-profile-detail__chip--region"
                    >
                      {region}
                    </span>
                  ))}
                  {(grape.regions ?? []).map((region) => (
                    <Link
                      key={region.slug ?? region.id}
                      to={`/regions/${encodeURIComponent(region.slug)}`}
                      className="wine-profile-detail__chip wine-profile-detail__chip--region"
                    >
                      {region.name}
                    </Link>
                  ))}
                  {grape.regions?.length + grape.main_regions?.length == 0 && (
                    <p className="wine-profile-detail__empty">Not specified</p>
                  )}
                </div>
              )}
            </div>
            {grape.synonyms?.length > 0 && (
              <>
                <div className="wine-profile-detail__origin-divider" />
                <div className="reference-detail__sidebar-group">
                  <p className="wine-profile-detail__eyebrow">Also known as</p>
                  <div className="wine-profile-detail__chips">
                    {grape.synonyms.map((synonym, index) => (
                      <span
                        key={`${synonym}-${index}`}
                        className="wine-profile-detail__chip"
                      >
                        {synonym}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function ArrayFieldInput({
  label,
  items,
  newValue,
  setNewValue,
  onAdd,
  onRemove,
  placeholder,
}: ArrayFieldInputProps) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <div className="array-input-group">
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder={placeholder}
        />
        <button type="button" onClick={onAdd} className="btn-add">
          Add
        </button>
      </div>
      <ul className="tags-list">
        {items.map((item, idx) => (
          <li key={idx} className="tag">
            {item}
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="tag-remove"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default GrapeDetail;
