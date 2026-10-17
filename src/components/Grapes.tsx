import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { grapesApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { isAdmin, canManageGrapes } from "../constants/roles";
import { errorMessage } from "../utils/errors";
import usePagedList from "../hooks/usePagedList";
import Pagination from "./Pagination";
import type { GrapeDetail } from "../types/catalog";
import type { QueryParams } from "../types/common";

/**
 * The editable columns of a grape. `relevance` is a string here (it lives in a
 * text input) and is coerced to a number-or-null in the submit payload.
 */
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

/** The three list-valued fields the `ArrayFieldInput` helper manages. */
type GrapeListField = "main_regions" | "synonyms" | "notes";

/** The list's server-side orderings (`?sort=` on GET /api/v1/grapes). */
type GrapeSortKey = "relevance" | "wines_count" | "producers_count";

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
];

function Grapes() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  // Form-level errors (validation, save, delete); list failures come from
  // `list.error` instead.
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Server-side list ordering; changing it refetches (extraParams) from page 1.
  const [sortBy, setSortBy] = useState<GrapeSortKey>("relevance");
  const list = usePagedList<GrapeDetail>({
    fetcher: (params: QueryParams) => grapesApi.list(params),
    // Omitted for the default so the API keeps its relevance ordering.
    extraParams: sortBy === "relevance" ? {} : { sort: sortBy },
  });
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<GrapeForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newRegion, setNewRegion] = useState("");
  const [newSynonym, setNewSynonym] = useState("");
  const [newNote, setNewNote] = useState("");

  const isWineManager = isAdmin(user) || canManageGrapes(user);

  function updateField<K extends keyof GrapeForm>(
    field: K,
    value: GrapeForm[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setMode("create");
    setEditingId(null);
    setShowForm(false);
    setForm(emptyForm);
    setNewRegion("");
    setNewSynonym("");
    setNewNote("");
  }

  function openCreateForm() {
    setMode("create");
    setEditingId(null);
    setForm(emptyForm);
    setNewRegion("");
    setNewSynonym("");
    setNewNote("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSortChange(next: GrapeSortKey) {
    setSortBy(next);
    // A different ordering invalidates the current page position.
    if (list.page !== 1) list.setPage(1);
  }

  function addArrayField(
    field: GrapeListField,
    value: string,
    setter: (next: string) => void,
  ) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (form[field].includes(trimmed)) return;
    updateField(field, [...form[field], trimmed]);
    setter("");
  }

  function removeArrayField(field: GrapeListField, index: number) {
    updateField(
      field,
      form[field].filter((_, i) => i !== index),
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
      if (mode === "edit" && editingId) {
        await grapesApi.update(editingId, payload);
        setNotice(`Grape "${payload.name}" updated.`);
      } else {
        await grapesApi.create(payload);
        setNotice(`Grape "${payload.name}" created.`);
      }
      resetForm();
      await list.reload();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to save grape"));
    } finally {
      setSaving(false);
    }
  }

  // Edit and Delete entry points: they drive the shared form above
  // (handleSubmit, mode/editingId) and the destroy call below, and are
  // rendered from each table row's actions.
  function startEdit(grape: GrapeDetail) {
    setMode("edit");
    setEditingId(grape.id);
    setShowForm(true);
    setForm({
      name: grape.name || "",
      color: grape.color || "",
      origin_country: grape.origin_country || "",
      main_regions: grape.main_regions || [],
      synonyms: grape.synonyms || [],
      is_blending_grape: !!grape.is_blending_grape,
      notes: grape.notes || [],
      serving: grape.serving || "",
      relevance: String(grape.relevance ?? ""),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(grape: GrapeDetail) {
    if (!window.confirm(`Delete grape "${grape.name}"? This cannot be undone.`))
      return;
    setError(null);
    setNotice(null);
    try {
      await grapesApi.remove(grape.id);
      setNotice(`Grape "${grape.name}" deleted.`);
      if (editingId === grape.id) resetForm();
      await list.reload();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to delete grape"));
    }
  }

  return (
    <div className="grapes-page">
      <h1 className="grapes-page__title">Grape Varieties</h1>

      {(error ?? list.error) && (
        <div className="flash flash--alert">{error ?? list.error}</div>
      )}
      {notice && <div className="flash flash--notice">{notice}</div>}

      {isWineManager && showForm && (
        <section className="grape-form-section">
          <h2>{mode === "edit" ? "Edit Grape" : "New Grape"}</h2>
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
                {saving
                  ? "Saving…"
                  : mode === "edit"
                    ? "Update Grape"
                    : "Create Grape"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={resetForm}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="grapes-list-section">
        <div className="section-header">
          <h2>All Grapes</h2>
          <div className="section-header__actions">
            <select
              className="sort-select"
              aria-label="Sort grapes"
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as GrapeSortKey)}
            >
              <option value="relevance">Sort by Relevance</option>
              <option value="wines_count">Sort by Wines</option>
              <option value="producers_count">Sort by Producers</option>
            </select>
            {isWineManager && (
              <button
                type="button"
                className="btn-primary"
                onClick={openCreateForm}
              >
                + Add New Grape Variety
              </button>
            )}
          </div>
        </div>
        {list.loading ? (
          <p className="loading">Loading grapes…</p>
        ) : list.items.length === 0 ? (
          <p className="empty">No grapes found.</p>
        ) : (
          <>
            <table className="grapes-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Color</th>
                  <th>Origin</th>
                  <th>Synonyms</th>
                  <th>Wines</th>
                  <th>Producers</th>
                  {isWineManager && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {list.items.map((grape, index) => (
                  <tr
                    key={grape.id}
                    className={
                      index % 2 === 0 ? "grapes-row--even" : "grapes-row--odd"
                    }
                  >
                    <td>
                      <Link
                        to={`/grapes/${grape.slug}`}
                        className="grapes-table__link"
                      >
                        {grape.name}
                      </Link>
                    </td>
                    <td>{grape.color || "—"}</td>
                    <td>{grape.origin_country || "—"}</td>
                    <td>
                      {grape.synonyms?.length
                        ? grape.synonyms.slice(0, 3).join(", ") +
                          (grape.synonyms.length > 3 ? "…" : "")
                        : "—"}
                    </td>
                    <td>
                      {grape.wines_count > 0 ? (
                        <Link
                          to={`/grapes/${grape.slug}/wines`}
                          className="grapes-table__link"
                        >
                          {`${grape.wines_count} wine${
                            grape.wines_count !== 1 ? "s" : ""
                          }`}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {grape.producers_count > 0 ? (
                        <Link
                          to={`/grapes/${grape.slug}/producers`}
                          className="grapes-table__link"
                        >
                          {`${grape.producers_count} producer${
                            grape.producers_count !== 1 ? "s" : ""
                          }`}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    {isWineManager && (
                      <td className="actions">
                        <Link
                          to={`/grapes/${grape.slug}`}
                          className="btn-action"
                        >
                          Show
                        </Link>
                        <button
                          type="button"
                          className="btn-action"
                          onClick={() => startEdit(grape)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-action btn-action--delete"
                          onClick={() => handleDelete(grape)}
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={list.page}
              totalPages={list.totalPages}
              totalCount={list.totalCount}
              onPageChange={list.setPage}
              alwaysShow={list.totalPages > 1}
            />
          </>
        )}
      </section>
    </div>
  );
}

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

export default Grapes;
