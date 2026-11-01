import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { winesApi, winePackageItemsApi } from "../services/api";
import type { WinePackageItemWritePayload } from "../types/api";
import type { Vintage, Wine, WineListItem } from "../types/wine";
import { errorMessage } from "../utils/errors";
import InlineVintageCreateForm from "./InlineVintageCreateForm";
import InlineWineCreateForm from "./InlineWineCreateForm";
import styles from "./winePackages.module.css";

/**
 * The subset of a package line this form reads and writes. `WinePackageItem`
 * carries an open index signature, so these fields are declared explicitly here
 * rather than read off that type.
 */
interface PackageItemDraft {
  id: number;
  vintage_id?: number | null;
  quantity?: number | null;
  review_requested?: boolean | null;
  condition?: string | null;
  notes?: string | null;
  proposed_wine_name?: string | null;
  proposed_vintage_year?: number | null;
}

/** Which create-panel currently replaces this form. */
type CreatePanel = "wine" | "vintage";

/**
 * Editable line fields. `quantity` is a number on first render (taken from the
 * line) and a string once the reviewer types, hence the union — the input needs
 * a string and `Number()` normalises it on submit.
 */
interface ItemFormState {
  quantity: string | number;
  review_requested: boolean;
  condition: string;
  notes: string;
}

interface WinePackageItemFormProps {
  packageId: number | string;
  /** Present when editing an existing line, absent when adding a new one. */
  item?: PackageItemDraft;
  producerId?: number | string | null;
  producerName?: string | null;
  onSaved: (saved: Awaited<ReturnType<typeof winePackageItemsApi.create>>) => void;
  onCancel: () => void;
  /** Producer users are restricted to this package's producer catalogue. */
  producerMode?: boolean;
}

// Add or edit one wine line inside a package.
//
// The package's producer decides the catalogue on offer: the line lists that
// producer's wines and their vintages, so the reviewer picks a bottle instead of
// guessing a wine name. A wine or a vintage we have never recorded can be added
// right here (a new wine is created together with its first vintage), and the
// unmatched fallback stays for a bottle nobody can identify yet.
//
// We review a vintage of a wine — never a wine — so any line that is not
// unmatched carries a vintage_id.
function WinePackageItemForm({
  packageId,
  item,
  producerId,
  producerName,
  onSaved,
  onCancel,
  producerMode = false,
}: WinePackageItemFormProps) {
  const [wines, setWines] = useState<WineListItem[]>([]);
  const [loadingWines, setLoadingWines] = useState(false);
  const [filter, setFilter] = useState("");
  const [wineId, setWineId] = useState("");
  const [vintageId, setVintageId] = useState(
    item?.vintage_id ? String(item.vintage_id) : "",
  );
  const [panel, setPanel] = useState<CreatePanel | null>(null);
  // A line that exists but has no vintage is the "not in the catalogue yet" case.
  const [unmatched, setUnmatched] = useState(
    item !== undefined && !item.vintage_id,
  );
  const [proposedName, setProposedName] = useState(item?.proposed_wine_name || "");
  const [proposedYear, setProposedYear] = useState(
    item?.proposed_vintage_year ? String(item.proposed_vintage_year) : "",
  );
  const [form, setForm] = useState<ItemFormState>({
    quantity: item?.quantity ?? 1,
    review_requested: item?.review_requested ?? true,
    condition: item?.condition || "",
    notes: item?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editing = Boolean(item);

  const selectedWine = useMemo(
    () => wines.find((candidate) => String(candidate.id) === wineId) || null,
    [wines, wineId],
  );

  const visibleWines = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return wines;
    return wines.filter((candidate) => candidate.name.toLowerCase().includes(needle));
  }, [wines, filter]);

  // Load this producer's catalogue once; the reviewer filters it locally.
  useEffect(() => {
    if (!producerId) return undefined;

    // Captured as a const so the narrowing above survives into `load`, which
    // TS does not carry into a closure for a reassignable parameter binding.
    const ownerProducerId = producerId;
    let cancelled = false;

    async function load() {
      setLoadingWines(true);
      try {
        const data = await winesApi.search({ producerId: ownerProducerId });
        if (!cancelled) setWines(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err, "Could not load this producer's wines"));
        }
      } finally {
        if (!cancelled) setLoadingWines(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [producerId]);

  // An edited line arrives without its wine, so recover it from the vintage.
  useEffect(() => {
    const targetVintageId = item?.vintage_id;
    if (!targetVintageId || wineId || wines.length === 0) return;

    const owner = wines.find((candidate) =>
      (candidate.vintages || []).some(
        (vintage) => String(vintage.id) === String(targetVintageId),
      ),
    );

    if (owner) {
      setWineId(String(owner.id));
      setUnmatched(false);
    }
  }, [wines, item, wineId]);

  function updateField<K extends keyof ItemFormState>(
    key: K,
    value: ItemFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function vintageLabel(vintage: Vintage): string {
    return vintage.no_vintage
      ? `NV (${vintage.year ?? ""})`
      : String(vintage.year);
  }

  function chooseWine(nextId: string) {
    setWineId(nextId);
    setUnmatched(false);

    const next = wines.find((candidate) => String(candidate.id) === nextId);
    // Preselect the newest vintage; the reviewer can change it.
    const first = next?.vintages?.[0];
    setVintageId(first ? String(first.id) : "");
  }

  function handleVintageCreated(vintage: Vintage) {
    setPanel(null);
    setWines((current) =>
      current.map((candidate) =>
        String(candidate.id) === wineId
          ? { ...candidate, vintages: [...(candidate.vintages || []), vintage] }
          : candidate,
      ),
    );
    setVintageId(String(vintage.id));
  }

  function handleWineCreated({
    wine,
    vintageId: createdVintageId,
  }: {
    wine: Wine;
    vintageId: number;
  }) {
    setPanel(null);
    setFilter("");
    setWines((current) =>
      [...current.filter((candidate) => candidate.id !== wine.id), wine].sort(
        (a, b) => a.name.localeCompare(b.name),
      ),
    );
    setWineId(String(wine.id));
    setVintageId(String(createdVintageId));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload: WinePackageItemWritePayload = {
        quantity: Number(form.quantity) || 1,
        review_requested: Boolean(form.review_requested),
        condition: form.condition || null,
        notes: form.notes || null,
      };

      if (unmatched) {
        payload.vintage_id = null;
        if (producerMode) {
          if (!proposedName.trim()) {
            setError("Enter the wine name when it is not in the catalogue yet.");
            setSaving(false);
            return;
          }
          payload.proposed_wine_name = proposedName.trim();
          payload.proposed_vintage_year = proposedYear ? Number(proposedYear) : null;
        }
      } else if (vintageId) {
        payload.vintage_id = Number(vintageId);
      } else if (!editing) {
        setError(
          "Pick a wine and a vintage, or mark the line as not in the catalogue yet.",
        );
        setSaving(false);
        return;
      }

      const saved =
        item && editing
          ? await winePackageItemsApi.update(packageId, item.id, payload)
          : await winePackageItemsApi.create(packageId, payload);

      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err, "Failed to save this wine line"));
      setSaving(false);
    }
  }

  // Creating a wine or a vintage takes over this form: both panels post their own
  // request, so they must not be nested inside the line's <form> element.
  if (panel === "wine") {
    return (
      <InlineWineCreateForm
        producerId={producerId ?? null}
        producerName={producerName}
        defaultName={filter.trim()}
        onCreated={handleWineCreated}
        onCancel={() => setPanel(null)}
      />
    );
  }

  if (panel === "vintage") {
    return (
      <InlineVintageCreateForm
        wine={selectedWine}
        onCreated={handleVintageCreated}
        onCancel={() => setPanel(null)}
      />
    );
  }

  return (
    <form className={styles.inlineForm} onSubmit={handleSubmit}>
      {error && <p className="wine-management__error">{error}</p>}

      {!unmatched && (
        <>
          <p className={styles.cellMuted}>
            Wines from <strong>{producerName || "this producer"}</strong>. Pick the wine
            and then the vintage that arrived — we review a vintage of a wine.
          </p>

          <div className={styles.filterField} style={{ flex: "1 1 12rem" }}>
            <label htmlFor="item-wine-filter">Filter wines</label>
            <input
              id="item-wine-filter"
              type="search"
              placeholder="Start typing a wine name…"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>

          <div className={styles.filterField} style={{ flex: "1 1 14rem" }}>
            <label htmlFor="item-wine">Wine</label>
            <select
              id="item-wine"
              value={wineId}
              disabled={loadingWines || visibleWines.length === 0}
              onChange={(event) => chooseWine(event.target.value)}
            >
              <option value="">
                {loadingWines
                  ? "Loading…"
                  : visibleWines.length === 0
                    ? "No wines to pick"
                    : "Select a wine…"}
              </option>
              {visibleWines.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </div>

          {selectedWine && (selectedWine.vintages || []).length > 0 && (
            <div className={styles.filterField}>
              <label htmlFor="item-vintage">Vintage</label>
              <select
                id="item-vintage"
                required
                value={vintageId}
                onChange={(event) => setVintageId(event.target.value)}
              >
                {(selectedWine.vintages || []).map((vintage) => (
                  <option key={vintage.id} value={vintage.id}>
                    {vintageLabel(vintage)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!loadingWines && wines.length === 0 && (
            <p className={styles.cellMuted}>
              {producerName || "This producer"} has no wines in the catalogue yet — add
              the first one below.
            </p>
          )}

          {selectedWine && (selectedWine.vintages || []).length === 0 && (
            <p className={styles.cellMuted}>
              <strong>{selectedWine.name}</strong> has no vintages recorded yet — add the
              vintage that arrived.
            </p>
          )}

          <div className={styles.inlineFormActions}>
            {selectedWine && (
              <button
                type="button"
                className="wine-btn wine-btn--secondary"
                onClick={() => setPanel("vintage")}
              >
                Add a vintage
              </button>
            )}
            <button
              type="button"
              className="wine-btn wine-btn--secondary"
              onClick={() => setPanel("wine")}
            >
              Add a new wine
            </button>
          </div>
        </>
      )}

      <label className={styles.checkboxField} htmlFor="item-unmatched">
        <input
          id="item-unmatched"
          type="checkbox"
          checked={unmatched}
          onChange={(event) => {
            setUnmatched(event.target.checked);
            if (event.target.checked) setVintageId("");
          }}
        />
        Not in the catalogue yet
      </label>

      {unmatched && producerMode && (
        <div className={styles.filters}>
          <div className={styles.filterField}>
            <label htmlFor="item-proposed-name">Wine name</label>
            <input
              id="item-proposed-name"
              type="text"
              required
              value={proposedName}
              onChange={(event) => setProposedName(event.target.value)}
            />
          </div>
          <div className={styles.filterField}>
            <label htmlFor="item-proposed-year">Vintage year (optional)</label>
            <input
              id="item-proposed-year"
              type="number"
              min="1900"
              max={new Date().getFullYear() + 2}
              value={proposedYear}
              onChange={(event) => setProposedYear(event.target.value)}
            />
          </div>
        </div>
      )}

      <div className={styles.filterField}>
        <label htmlFor="item-quantity">Bottles</label>
        <input
          id="item-quantity"
          type="number"
          min="1"
          value={form.quantity}
          onChange={(event) => updateField("quantity", event.target.value)}
        />
      </div>

      <label className={styles.checkboxField} htmlFor="item-review-requested">
        <input
          id="item-review-requested"
          type="checkbox"
          checked={form.review_requested}
          onChange={(event) => updateField("review_requested", event.target.checked)}
        />
        Review requested
      </label>

      <div className={styles.filterField}>
        <label htmlFor="item-condition">Condition</label>
        <input
          id="item-condition"
          type="text"
          placeholder="sealed, damaged label…"
          value={form.condition}
          onChange={(event) => updateField("condition", event.target.value)}
        />
      </div>

      <div className={styles.filterField} style={{ flex: "1 1 14rem" }}>
        <label htmlFor="item-notes">Notes</label>
        <input
          id="item-notes"
          type="text"
          value={form.notes}
          onChange={(event) => updateField("notes", event.target.value)}
        />
      </div>

      <div className={styles.inlineFormActions}>
        <button type="submit" className="wine-btn wine-btn--primary wine-btn--lg" disabled={saving}>
          {saving ? "Saving…" : editing ? "Save Line" : "Add Line"}
        </button>
        <button type="button" className="wine-btn wine-btn--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default WinePackageItemForm;
