import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { regionsApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { isAdmin, canManageGrapes } from "../constants/roles";
import { errorMessage } from "../utils/errors";
import DetailHero from "./DetailHero";
import type {
  CountryRegionNode,
  Region,
  RegionTreeNode as RegionTreeNodeData,
} from "../types/reference";

/** The create/edit region form's local state. IDs stay as strings so an empty
 * select and a cleared field are the same value; the payload coerces them. */
interface RegionFormValues {
  name: string;
  country_id: string;
  parent_id: string;
  is_state: boolean;
  is_appellation: boolean;
}

const emptyForm: RegionFormValues = {
  name: "",
  country_id: "",
  parent_id: "",
  is_state: false,
  is_appellation: false,
};

function typeLabel(region: Region | RegionTreeNodeData): string {
  const labels: string[] = [];
  if (region.is_state) labels.push("State");
  if (region.is_appellation) labels.push("Appellation");
  return labels.length > 0 ? labels.join(" / ") : "Region";
}

interface RegionTreeNodeProps {
  node: RegionTreeNodeData;
  level: number;
  /** The region being edited, as a string id — `null` when the form is closed. */
  targetRegionId: string | null;
  onEdit: (region: RegionTreeNodeData) => void;
  onDelete: (region: RegionTreeNodeData) => void;
  canManage: boolean;
}

// Tree node component for displaying regions recursively
function RegionTreeNode({
  node,
  level,
  targetRegionId,
  onEdit,
  onDelete,
  canManage,
}: RegionTreeNodeProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isCurrentRegion = String(node.id) === targetRegionId;
  const wineCount = node.wine_count || 0;
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="region-tree-node">
      <div
        className="region-tree-node__content"
        style={{ paddingLeft: `${level * 1.5}rem` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="region-tree__toggle region-tree__toggle--btn"
            onClick={toggleExpand}
            aria-expanded={isExpanded}
          >
            {isExpanded ? "-" : "+"}
          </button>
        ) : (
          <span className="region-tree__toggle region-tree__toggle--leaf">
            {" "}
          </span>
        )}
        <Link
          to={`/regions/${node.slug}`}
          className={`region-tree-node__name ${isCurrentRegion ? "region-tree-node__name--active" : ""}`}
        >
          {node.name}
          {hasChildren && (
            <span className="region-tree-node__type"> ({typeLabel(node)})</span>
          )}
        </Link>
        {wineCount > 0 && (
          <span className="region-tree-node__wine-count">
            {wineCount} wine{wineCount === 1 ? "" : "s"}
          </span>
        )}
        {canManage && (
          <span className="region-tree-node__actions">
            <button
              type="button"
              className="btn-action"
              onClick={() => onEdit(node)}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn-action btn-action--delete"
              onClick={() => onDelete(node)}
            >
              Delete
            </button>
          </span>
        )}
      </div>
      {hasChildren && isExpanded && node.children && (
        <div className="region-tree-node__children">
          {node.children.map((child) => (
            <RegionTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              targetRegionId={targetRegionId}
              onEdit={onEdit}
              onDelete={onDelete}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Regions() {
  const { slug: editSlug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = isAdmin(user) || canManageGrapes(user);
  // The tree response is the only payload carrying both the country columns the
  // create form needs (name, flag_emoji) and each country's nested `regions`
  // for the parent select, so there is no second fetch to reconcile.
  const [treeData, setTreeData] = useState<CountryRegionNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedCountries, setExpandedCountries] = useState<Set<number>>(
    new Set(),
  );
  // Active highlight follows the row sent into the edit form (null = none).
  const [targetRegionId, setTargetRegionId] = useState<string | null>(null);
  const [showOnlyWithWines, setShowOnlyWithWines] = useState(false);
  const [query, setQuery] = useState("");

  let displayTree = treeData ?? [];
  if (showOnlyWithWines) {
    displayTree = displayTree.filter((c) => (c.wine_count || 0) > 0);
  }
  const queryTrimmed = query.trim();
  if (queryTrimmed !== "") {
    const lowerQuery = queryTrimmed.toLowerCase();
    function filterCountry(
      country: CountryRegionNode,
    ): CountryRegionNode | null {
      const countryMatch = country.name.toLowerCase().includes(lowerQuery);
      const filteredRegions = country.regions
        .map(filterRegion)
        .filter((r): r is RegionTreeNodeData => r !== null);
      if (countryMatch || filteredRegions.length > 0) {
        return { ...country, regions: filteredRegions };
      }
      return null;
    }
    function filterRegion(
      region: RegionTreeNodeData,
    ): RegionTreeNodeData | null {
      const regionMatch = region.name.toLowerCase().includes(lowerQuery);
      const filteredChildren = region.children
        .map(filterRegion)
        .filter((c): c is RegionTreeNodeData => c !== null);
      if (regionMatch || filteredChildren.length > 0) {
        return { ...region, children: filteredChildren };
      }
      return null;
    }
    const filteredBySearch = displayTree
      .map(filterCountry)
      .filter((c): c is CountryRegionNode => c !== null);
    displayTree = filteredBySearch;
  }

  const loadTreeData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await regionsApi.tree();
      setTreeData(Array.isArray(data) ? data : []);
      if (Array.isArray(data)) {
        const australia = data.find(
          (c) => c.name.toLowerCase() === "australia",
        );
        if (australia) setExpandedCountries(new Set([australia.id]));
      }
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load regions tree"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTreeData();
    // The parent-region select reads `regions` off each country, which only the
    // *tree* endpoint provides — the flat /countries and /regions lists do not
    // carry it. So the tree response is the single source for that select.
  }, [loadTreeData]);

  useEffect(() => {
    const slug = editSlug ?? "";
    if (!slug) return;

    let cancelled = false;

    async function loadRegionForEdit() {
      try {
        setError(null);
        const region = await regionsApi.show(slug);
        if (cancelled) return;

        setMode("edit");
        setTargetRegionId(String(region.id));
        setEditingId(region.id);
        setForm({
          name: region.name,
          country_id:
            region.country_id == null ? "" : String(region.country_id),
          parent_id: region.parent_id == null ? "" : String(region.parent_id),
          is_state: Boolean(region.is_state),
          is_appellation: Boolean(region.is_appellation),
        });
        setShowForm(true);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, "Failed to load region"));
      }
    }

    void loadRegionForEdit();

    return () => {
      cancelled = true;
    };
  }, [editSlug]);

  function updateField<K extends keyof RegionFormValues>(
    field: K,
    value: RegionFormValues[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setMode("create");
    setEditingId(null);
    setTargetRegionId(null);
    setShowForm(false);
    setForm(emptyForm);
    if (editSlug) navigate("/regions");
  }

  function openCreateForm() {
    setMode("create");
    setEditingId(null);
    setTargetRegionId(null);
    setForm(emptyForm);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleCountry(countryId: number) {
    setExpandedCountries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(countryId)) {
        newSet.delete(countryId);
      } else {
        newSet.add(countryId);
      }
      return newSet;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.name.trim() || !form.country_id) {
      setError("Name and Country are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        country_id: form.country_id ? parseInt(form.country_id, 10) : null,
        parent_id: form.parent_id ? parseInt(form.parent_id, 10) : null,
        is_state: form.is_state,
        is_appellation: form.is_appellation,
      };
      if (mode === "edit" && editingId) {
        await regionsApi.update(editingId, payload);
        setNotice(`Region "${payload.name}" updated.`);
      } else {
        await regionsApi.create(payload);
        setNotice(`Region "${payload.name}" created.`);
      }
      resetForm();
      await loadTreeData();
    } catch (err) {
      setError(errorMessage(err, "Failed to save region"));
    } finally {
      setSaving(false);
    }
  }

  // Edit and Delete entry points: they drive the shared form above
  // (handleSubmit, mode/editingId) and the destroy call below, and are
  // rendered from each tree row's actions.
  function startEdit(region: RegionTreeNodeData) {
    setMode("edit");
    setTargetRegionId(String(region.id));
    setEditingId(region.id);
    setForm({
      name: region.name,
      country_id: region.country_id == null ? "" : String(region.country_id),
      parent_id: region.parent_id == null ? "" : String(region.parent_id),
      is_state: Boolean(region.is_state),
      is_appellation: Boolean(region.is_appellation),
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(region: RegionTreeNodeData) {
    if (window.confirm(`Delete region "${region.name}"?`)) {
      try {
        await regionsApi.remove(region.id);
        setNotice(`Region "${region.name}" deleted.`);
        await loadTreeData();
      } catch (err) {
        setError(errorMessage(err, "Failed to delete region"));
      }
    }
  }

  return (
    <div className="grapes-page">
      {error && <div className="flash flash--alert">{error}</div>}
      {notice && <div className="flash flash--notice">{notice}</div>}

      <Link to="/" className="wine-detail__back">
        &larr; Back to Dashboard
      </Link>
      <DetailHero
        kicker="Cellar"
        title="Regions"
        intro="Browse the wine regions tree, organised by country. Each region links to the wines grown there."
        actions={
          <button
            type="button"
            className="auth-form__submit"
            onClick={openCreateForm}
            disabled={!canManage}
          >
            + Add Region
          </button>
        }
      />

      <section>

        {showForm && (
          <section>
            <div className="grapes-page__form-container">
              <form className="grape-form" onSubmit={handleSubmit}>
                <h2>{mode === "edit" ? "Edit Region" : "New Region"}</h2>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="region-name">Name *</label>
                    <input
                      type="text"
                      id="region-name"
                      value={form.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      disabled={saving}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="region-country">Country *</label>
                    <select
                      id="region-country"
                      value={form.country_id}
                      onChange={(e) =>
                        updateField("country_id", e.target.value)
                      }
                      disabled={saving || treeData.length === 0}
                    >
                      <option value="">Select a country</option>
                      {treeData.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.flag_emoji} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="region-parent">Parent Region</label>
                    <select
                      id="region-parent"
                      value={form.parent_id || ""}
                      onChange={(e) => updateField("parent_id", e.target.value)}
                      disabled={saving}
                    >
                      <option value="">No parent (top-level region)</option>
                      {treeData
                        .map((c: CountryRegionNode) =>
                          c.regions
                            ?.filter(
                              (r: RegionTreeNodeData) => r.parent_id === null,
                            )
                            .map((r: RegionTreeNodeData) => (
                              <option key={r.id + "-parent"} value={r.id}>
                                {r.name} ({c.name})
                              </option>
                            )),
                        )
                        .flat(2)
                        .filter(Boolean) || []}
                    </select>
                  </div>
                  <div className="form-group">
                    <div className="checkbox-label">
                      <input
                        type="checkbox"
                        id="region-is-state"
                        checked={form.is_state}
                        onChange={(e) =>
                          updateField("is_state", e.target.checked)
                        }
                      />
                      <label htmlFor="region-is-state">is State?</label>
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <div className="checkbox-label">
                    <input
                      type="checkbox"
                      id="region-is-appellation"
                      checked={form.is_appellation}
                      onChange={(e) =>
                        updateField("is_appellation", e.target.checked)
                      }
                    />
                    <label htmlFor="region-is-appellation">
                      is Appellation?
                    </label>
                  </div>
                </div>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={saving}
                  >
                    {mode === "edit" ? "Update" : "Create"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={resetForm}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        <div className="region-tree-search">
          <label>
            Search regions:{" "}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search regions..."
            />
          </label>
        </div>

        <div className="region-tree-filter">
          <label className="region-tree-filter__label">
            <input
              type="checkbox"
              checked={showOnlyWithWines}
              onChange={(e) => setShowOnlyWithWines(e.target.checked)}
            />
            Only countries with wines
          </label>
        </div>

        {loading ? (
          <p className="grapes-page__loading">Loading regions…</p>
        ) : displayTree.length === 0 ? (
          queryTrimmed !== "" ? (
            <p className="grapes-page__empty">No regions match your search.</p>
          ) : showOnlyWithWines ? (
            <p className="grapes-page__empty">
              No countries or regions with wines found.
            </p>
          ) : (
            <p className="grapes-page__empty">No countries or regions found.</p>
          )
        ) : (
          <div className="region-tree-container">
            {displayTree.map((country) => {
              const countryWineCount = country.wine_count || 0;

              if (!country.regions?.length) return null;

              return (
                <div key={country.id} className="region-tree-country">
                  <div
                    className="region-tree-country__header"
                    onClick={() => toggleCountry(country.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleCountry(country.id);
                      }
                    }}
                  >
                    <span className="region-tree-country__toggle">
                      {expandedCountries.has(country.id) ? "-" : "+"}
                    </span>

                    <span className="region-tree-country__flag">
                      {country.flag_emoji}
                    </span>

                    <span className="region-tree-country__name">
                      {country.name}
                    </span>

                    <span className="region-tree-country__count">
                      {countryWineCount} wine{countryWineCount === 1 ? "" : "s"}
                    </span>
                  </div>

                  {expandedCountries.has(country.id) && (
                    <div className="region-tree-country__regions">
                      {country.regions?.map((region) => (
                        <RegionTreeNode
                          key={region.id}
                          node={region}
                          level={1}
                          targetRegionId={targetRegionId}
                          onEdit={startEdit}
                          onDelete={handleDelete}
                          canManage={canManage}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default Regions;
