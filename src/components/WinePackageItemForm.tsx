import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { winesApi, vintagesApi, winePackageItemsApi } from "../services/api";
import type { WinePackageItemWritePayload } from "../types/api";
import type { WineListItem } from "../types/wine";
import { errorMessage } from "../utils/errors";
import InlineVintageCreateForm from "./InlineVintageCreateForm";
import InlineWineCreateForm from "./InlineWineCreateForm";
import styles from "./winePackages.module.css";

interface PackageItemDraft {
  id: number;
  vintage_id?: number | null;
  quantity?: number | null;
  review_requested?: boolean | null;
  condition?: string | null;
  notes?: string | null;
  proposed_wine_name?: string | null;
  proposed_vintage_year?: number | null;
  resolution_status?: string;
}

type CreatePanel = "wine" | "vintage";

interface ItemFormState {
  quantity: string | number;
  review_requested: boolean;
  condition: string;
  notes: string;
}

interface WinePackageItemFormProps {
  packageId: number | string;
  item?: PackageItemDraft;
  /** The package's primary producer (reference only — items may use any producer). */
  packageProducerId?: number | string | null;
  packageProducerName?: string | null;
  /** Legacy aliases kept so existing call sites keep working. */
  producerId?: number | string | null;
  producerName?: string | null;
  onSaved: (saved: Awaited<ReturnType<typeof winePackageItemsApi.create>>) => void;
  onCancel: () => void;
  producerMode?: boolean;
  /** Initial "Review requested" value for NEW lines (editing uses the line's own flag). */
  defaultReviewRequested?: boolean;
}

function WinePackageItemForm({
  packageId,
  item,
  packageProducerId,
  packageProducerName,
  producerId,
  producerName,
  onSaved,
  onCancel,
  producerMode = false,
  defaultReviewRequested = false,
}: WinePackageItemFormProps) {
  // Accept either the new or legacy prop names for the package producer.
  const ownerProducerId = packageProducerId ?? producerId ?? null;
  const ownerProducerName = packageProducerName ?? producerName ?? null;
  const [wines, setWines] = useState<WineListItem[]>([]);
  const [loadingWines, setLoadingWines] = useState(false);
  const [filter, setFilter] = useState("");
  const [wineId, setWineId] = useState("");
  const [vintageId, setVintageId] = useState(
    item?.vintage_id ? String(item.vintage_id) : "",
  );
  const [panel, setPanel] = useState<CreatePanel | null>(null);
  // Track if vintage was manually selected by user
  const [vintageManuallySet, setVintageManuallySet] = useState(false);

  const isUnmatched = !wineId && !vintageId;

  const originalProposedName = item?.proposed_wine_name || "";
  const originalProposedYear = item?.proposed_vintage_year
    ? String(item.proposed_vintage_year)
    : "";

  const [proposedName, setProposedName] = useState(originalProposedName);
  const [proposedYear, setProposedYear] = useState(originalProposedYear);
  const [form, setForm] = useState<ItemFormState>({
    quantity: item?.quantity ? String(item.quantity) : "1",
    // Editing wins over the caller's default; new lines in review-scoped
    // trade packages start requested so the badge and billing stay consistent.
    review_requested: item ? (item.review_requested ?? false) : defaultReviewRequested,
    condition: item?.condition || "",
    notes: item?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = item !== undefined;
  const packageProducerIdNum = ownerProducerId ? Number(ownerProducerId) : null;

  // Debounced search timer + guards so a stale response never replaces a newer one.
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstSearchRef = useRef(true);
  const requestIdRef = useRef(0);

  // Runs a server-side catalogue search. The query is only sent when the user
  // has typed something, so an empty box never replaces the producer listing.
  function loadWines(query: string) {
    const requestId = ++requestIdRef.current;
    setLoadingWines(true);
    const params: Record<string, string | number> = {};
    if (query.trim()) params.q = query.trim();
    if (producerMode && packageProducerIdNum) params.producerId = packageProducerIdNum;
    Promise.resolve(winesApi.search(params))
      .then((data) => {
        if (requestId === requestIdRef.current) setWines(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (requestId === requestIdRef.current) setError(errorMessage(err, "Failed to load wines"));
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoadingWines(false);
      });
  }

  // Load the initial catalogue once (the producer's list in producer mode).
  useEffect(() => {
    loadWines("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producerMode, packageProducerIdNum]);

  // Debounced server-side search whenever the filter text changes. The first
  // run is skipped because the mount effect above already loaded the catalogue.
  useEffect(() => {
    if (firstSearchRef.current) {
      firstSearchRef.current = false;
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => loadWines(filter), 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, producerMode, packageProducerIdNum]);

  // Editing: recover the wine from the item's vintage once the list is loaded.
  useEffect(() => {
    if (wineId !== "" || !item?.vintage_id || wines.length === 0) return;
    const targetVintage = String(item.vintage_id);
    const owner = wines.find((candidate) =>
      (candidate.vintages || []).some((v) => String(v.id) === targetVintage),
    );
    if (owner) {
      setWineId(String(owner.id));
      setVintageId(targetVintage);
      setVintageManuallySet(true);
    }
  }, [wines, item, wineId]);

  // Preselect a sensible vintage when a wine is chosen (unless the user picked one).
  useEffect(() => {
    if (vintageManuallySet || wineId === "") return;
    const wine = wines.find((w) => String(w.id) === wineId);
    if (!wine?.vintages?.length) {
      setVintageId("");
      return;
    }
    const match = proposedYear
      ? wine.vintages.find((v) => String(v.year) === proposedYear)
      : undefined;
    const sorted = [...wine.vintages].sort((a, b) => (b.year || 0) - (a.year || 0));
    const chosen = match ?? sorted[0];
    if (chosen) setVintageId(String(chosen.id));
  }, [wineId, wines, proposedYear, vintageManuallySet]);

  function updateField(key: keyof ItemFormState, value: string | number | boolean) {
    setForm((c) => ({ ...c, [key]: value }));
  }

  function handleVintageSelectChange(event: { target: { value: string } }) {
    setVintageId(event.target.value);
    setVintageManuallySet(true);
  }

  // Add the freshly created vintage to the loaded wine so the dropdown shows it
  // immediately (no full reload, and the value can be selected straight away).
  function handleVintageCreated(created: Awaited<ReturnType<typeof vintagesApi.create>>) {
    setWines((current) =>
      current.map((wine) =>
        String(wine.id) === wineId
          ? { ...wine, vintages: [...(wine.vintages || []), created] }
          : wine,
      ),
    );
    setVintageId(String(created.id));
    setVintageManuallySet(true);
    setPanel(null);
  }

  function handleWineCreated(result: {
    wine: Awaited<ReturnType<typeof winesApi.create>>;
    vintageId: number;
  }) {
    setWines((current) => {
      const created = {
        ...result.wine,
        vintages: result.wine.vintages || [],
      };
      const exists = current.some((wine) => wine.id === created.id);
      return exists
        ? current.map((wine) => (wine.id === created.id ? created : wine))
        : [created, ...current];
    });
    setWineId(String(result.wine.id));
    setVintageId(String(result.vintageId));
    setVintageManuallySet(true);
    setPanel(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (producerMode && isUnmatched && !proposedName.trim()) {
      setError("Enter the wine name when it is not in the catalogue yet.");
      return;
    }
    if (!producerMode && isUnmatched) {
      setError("Select a wine and vintage from the catalogue.");
      return;
    }
    const payload: WinePackageItemWritePayload = {
      quantity: Number(form.quantity),
      review_requested: form.review_requested,
      condition: form.condition || null,
      notes: form.notes || null,
    };
    if (isUnmatched) {
      payload.proposed_wine_name = proposedName || null;
      payload.proposed_vintage_year = proposedYear ? Number(proposedYear) : null;
    } else {
      payload.vintage_id = Number(vintageId);
    }
    setSaving(true);
    setError(null);
    try {
      const saved = editing
        ? await winePackageItemsApi.update(packageId, item.id, payload)
        : await winePackageItemsApi.create(packageId, payload);
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err, "Failed to save line"));
      setSaving(false);
    }
  }

  const selectedWine = wines.find((w) => String(w.id) === wineId);
  const selectedVintage = selectedWine?.vintages?.find((v) => String(v.id) === vintageId);
  // Keep the selected wine in the list even when a new search no longer returns
  // it, so a search never silently clears an existing selection.
  const wineOptions =
    selectedWine && !wines.some((wine) => wine.id === selectedWine.id)
      ? [selectedWine, ...wines]
      : wines;

  // The line form and the create panels are siblings, never nested: the create
  // panels post their own request and must stay visible next to the wine fields.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <form
        className={`${styles.inlineForm} ${styles.lineForm}`}
        onSubmit={handleSubmit}
      >
        {error && (
          <p className={`wine-management__error ${styles.spanFull}`}>{error}</p>
        )}

        {producerMode === true && ownerProducerName && (
          <p className={`${styles.cellMuted} ${styles.spanFull}`}>
            Catalogue limited to <strong>{ownerProducerName}</strong>.
          </p>
        )}

        {producerMode === false && (
          <div className={`${styles.filterField} ${styles.spanSearch}`}>
            <label htmlFor="item-wine-filter">Search wines (all producers)</label>
            <input
              id="item-wine-filter"
              type="text"
              placeholder="Type to search..."
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            {loadingWines && (
              <span className={styles.cellMuted}>Searching the catalogue...</span>
            )}
          </div>
        )}

        {producerMode === false && (
          <div className={`${styles.inlineFormActions} ${styles.spanActions}`}>
            <button
              type="button"
              className="wine-btn wine-btn--secondary"
              onClick={() => setPanel(panel === "vintage" ? null : "vintage")}
              disabled={wineId === "" || saving}
            >
              {panel === "vintage" ? "Close vintage form" : "Add a vintage"}
            </button>
            <button
              type="button"
              className="wine-btn wine-btn--secondary"
              onClick={() => setPanel(panel === "wine" ? null : "wine")}
            >
              {panel === "wine" ? "Close new wine form" : "Add a new wine"}
            </button>
          </div>
        )}

        <div className={`${styles.filterField} ${styles.spanWine}`}>
          <label htmlFor="item-wine-select">
            {producerMode ? "Wine (package producer)" : "Wine"}
          </label>
          <select
            id="item-wine-select"
            value={wineId}
            onChange={(event) => {
              setWineId(event.target.value);
              setVintageManuallySet(false);
            }}
          >
            <option value="">Select a wine...</option>
            {wineOptions.map((wine) => (
              <option key={wine.id} value={String(wine.id)}>
                {wine.name} -- {wine.producer?.name || "Unknown producer"}
              </option>
            ))}
          </select>
        </div>

        <div className={`${styles.filterField} ${styles.spanVintage}`}>
          <label htmlFor="item-vintage-select">Vintage</label>
          <select
            id="item-vintage-select"
            value={vintageId}
            onChange={handleVintageSelectChange}
          >
            <option value="">Select a vintage...</option>
            {selectedWine?.vintages?.map((vintage) => (
              <option key={vintage.id} value={String(vintage.id)}>
                {vintage.no_vintage ? "NV" : vintage.year}
              </option>
            ))}
          </select>
        </div>
        {isUnmatched && (
          <div className={`${styles.unmatchedInfo} ${styles.spanFull}`}>
            <p className={styles.unmatchedLabel}>
              {producerMode
                ? "Proposed wine (not in catalogue yet)"
                : "Unmatched -- select a wine from the catalogue"}
            </p>
            {originalProposedName && (
              <p className={styles.referenceValue}>
                <strong>Submitted wine:</strong> {originalProposedName}
                {originalProposedYear && <span> ({originalProposedYear})</span>}
              </p>
            )}
          </div>
        )}

        {isUnmatched && producerMode && (
          <>
            <div className={`${styles.filterField} ${styles.spanProposedName}`}>
              <label htmlFor="item-proposed-name">Wine name *</label>
              <input
                id="item-proposed-name"
                type="text"
                required
                value={proposedName}
                onChange={(event) => setProposedName(event.target.value)}
                placeholder="e.g. Estate Shiraz"
              />
            </div>
            <div className={`${styles.filterField} ${styles.spanProposedYear}`}>
              <label htmlFor="item-proposed-year">Vintage year (optional)</label>
              <input
                id="item-proposed-year"
                type="number"
                min="1900"
                max={new Date().getFullYear() + 2}
                value={proposedYear}
                onChange={(event) => setProposedYear(event.target.value)}
                placeholder="2024"
              />
            </div>
          </>
        )}

        {wineId !== "" && (
          <div className={`${styles.wineInfo} ${styles.spanFull}`}>
            <p className={styles.wineInfoLabel}>
              <strong>Selected:</strong> {selectedWine?.name}
              {selectedWine?.producer?.name && (
                <span> -- {selectedWine.producer.name}</span>
              )}
              {selectedVintage && (
                <span> {selectedVintage.no_vintage ? "NV" : selectedVintage.year}</span>
              )}
            </p>
            {originalProposedName && (
              <p className={styles.referenceValue}>
                <strong>Submitted wine:</strong> {originalProposedName}
                {originalProposedYear && <span> ({originalProposedYear})</span>}
              </p>
            )}
          </div>
        )}

        <div className={`${styles.filterField} ${styles.spanBottles}`}>
          <label htmlFor="item-quantity">Bottles</label>
          <input
            id="item-quantity"
            type="number"
            min="1"
            value={form.quantity}
            onChange={(event) => updateField("quantity", event.target.value)}
          />
        </div>

        <div className={`${styles.filterField} ${styles.spanCondition}`}>
          <label htmlFor="item-condition">Condition</label>
          <input
            id="item-condition"
            type="text"
            placeholder="sealed, damaged label..."
            value={form.condition}
            onChange={(event) => updateField("condition", event.target.value)}
          />
        </div>

        <div className={`${styles.filterField} ${styles.spanNotes}`}>
          <label htmlFor="item-notes">Notes</label>
          <input
            id="item-notes"
            type="text"
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
          />
        </div>

        <div className={`${styles.reviewRequestBox} ${styles.spanFull}`}>
          <input
            id="item-review-requested"
            type="checkbox"
            checked={form.review_requested}
            onChange={(event) => updateField("review_requested", event.target.checked)}
          />
          <label htmlFor="item-review-requested">
            <span className={styles.reviewRequestTitle}>Review requested</span>
            <span className={styles.reviewRequestHint}>
              A requested line must be reviewed before the package can be completed.
              Trade packages are billed per bottle — keep this on for every line;
              it is set automatically once the samples arrive.
            </span>
          </label>
        </div>

        <div className={`${styles.inlineFormActions} ${styles.spanFull}`}>
          <button
            type="submit"
            className="wine-btn wine-btn--primary wine-btn--lg"
            disabled={saving}
          >
            {saving ? "Saving..." : editing ? "Save Line" : "Add Line"}
          </button>
          <button type="button" className="wine-btn wine-btn--secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>

      {panel === "vintage" && (
        <InlineVintageCreateForm
          wine={{ slug: selectedWine?.slug || null, name: selectedWine?.name || null }}
          defaultYear={proposedYear || String(new Date().getFullYear())}
          onCreated={handleVintageCreated}
          onCancel={() => setPanel(null)}
        />
      )}

      {panel === "wine" && (
        <InlineWineCreateForm
          defaultName={proposedName}
          defaultVintageYear={proposedYear}
          onCreated={handleWineCreated}
          onCancel={() => setPanel(null)}
        />
      )}
    </div>
  );
}

export default WinePackageItemForm;
