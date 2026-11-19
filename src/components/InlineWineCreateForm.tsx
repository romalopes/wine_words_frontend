// Inline wine + vintage creation for the package line flow.
//
// Basic info only (producer, name, colour, optional designation, first vintage
// year). The producer is picked with the same searchable picker as /wines/new
// (ProducerSearch): debounced search, plus an inline "create producer" action
// when nothing matches. Posts wine + first vintage in ONE wines#create request
// (vintages_attributes) and returns { wine, vintageId } via onCreated so the
// line form can select both immediately.
import { useEffect, useState } from "react";
import { winesApi } from "../services/api";
import { DEFAULT_COLOR } from "../data/wineVolumes";
import { errorMessage } from "../utils/errors";
import type { Wine } from "../types/wine";
import ProducerSearch from "./ProducerSearch";
import styles from "./winePackages.module.css";

// Mirrors Wine::COLORS (the backend is the source of truth; the model
// validates presence, not inclusion, so an extra value here would still save).
const COLOR_OPTIONS = ["Red", "White", "Rosé", "Dessert"];

const currentYear = () => String(new Date().getFullYear());

/** The wine fields this inline form collects, all held as strings for `<input>`. */
interface WineFormState {
  name: string
  color: string
  designation_name: string
  vintage_year: string
}

interface InlineWineCreateFormProps {
  /** Optional pre-selected producer (id + name) handed over by the caller. */
  producerId?: number | string | null
  producerName?: string | null | undefined
  defaultName?: string | undefined
  defaultVintageYear?: string | undefined
  onCreated: (result: { wine: Wine; vintageId: number }) => void
  onCancel?: (() => void) | undefined
}

function InlineWineCreateForm({
  producerId,
  producerName,
  defaultName = "",
  defaultVintageYear = "",
  onCreated,
  onCancel,
}: InlineWineCreateFormProps) {
  const [form, setForm] = useState<WineFormState>({
    name: defaultName,
    color: DEFAULT_COLOR,
    designation_name: "",
    vintage_year: defaultVintageYear || currentYear(),
  });
  const [producer, setProducer] = useState<{ id: string; name: string }>({
    id: producerId ? String(producerId) : "",
    name: producerName || "",
  });
  const [noVintage, setNoVintage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Same convenience as /wines/new: while "Auto-generate name" is on, the name
  // is producer + designation. It starts ON for a blank proposal (nothing to
  // preserve) and OFF when the panel is pre-filled with a submitted name, so a
  // resolution keeps the submitter's wording unless the editor opts in.
  const [autoName, setAutoName] = useState(defaultName.trim() === "");

  useEffect(() => {
    if (!autoName) return;
    const parts = [producer.name, form.designation_name]
      .map((part) => part.trim())
      .filter(Boolean);
    const computed = parts.join(" ");
    setForm((current) =>
      current.name === computed ? current : { ...current, name: computed },
    );
  }, [autoName, producer.name, form.designation_name]);

  function handleNameChange(value: string) {
    // Typing a name by hand is an explicit override — turn the flag off, like
    // the wine form does.
    if (autoName) setAutoName(false);
    updateField("name", value);
  }

  function updateField<Key extends keyof WineFormState>(
    key: Key,
    value: WineFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleProducerChange(id: string | number, name: string) {
    setProducer({ id: id ? String(id) : "", name: name || "" });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!producer.id) {
      setError("Search and select a producer, or create a new one below.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // The Vintage model requires a year, so a non-vintage wine still stores
      // the current year alongside no_vintage: true.
      const year = noVintage ? currentYear() : form.vintage_year;
      const payload = {
        name: form.name.trim(),
        color: form.color,
        designation_name: form.designation_name || null,
        producer_id: Number(producer.id),
        vintages_attributes: [{ year: Number(year), no_vintage: noVintage }],
      };

      const created = await winesApi.create(payload);
      const vintage =
        (created.vintages || []).find(
          (candidate) => String(candidate.year) === String(year),
        ) || (created.vintages || [])[0];

      if (!vintage?.id) {
        throw new Error("Wine was created but its vintage could not be resolved");
      }

      onCreated({ wine: created, vintageId: vintage.id });
    } catch (err) {
      setError(errorMessage(err, "Failed to create wine"));
      setSaving(false);
    }
  }

  return (
    <form className={styles.inlineForm} onSubmit={handleSubmit}>
      <p className={styles.cellMuted}>
        New wine — search for the producer below (or create it if it does not
        exist yet). The wine is created together with its first vintage, so the
        line can be reviewed straight away.
      </p>

      {error && <p className="wine-management__error">{error}</p>}

      <div className={styles.filterField} style={{ flex: "1 1 16rem" }}>
        <ProducerSearch value={producer.name} onChange={handleProducerChange} />
      </div>

      <div className={styles.filterField} style={{ flex: "1 1 14rem" }}>
        <label htmlFor="inline-wine-name">Wine name</label>
        <input
          id="inline-wine-name"
          type="text"
          required
          readOnly={autoName}
          value={form.name}
          onChange={(event) => handleNameChange(event.target.value)}
          placeholder="e.g. Château Margaux"
        />
      </div>

      <label className={styles.checkboxField} htmlFor="inline-wine-auto-name">
        <input
          id="inline-wine-auto-name"
          type="checkbox"
          checked={autoName}
          onChange={() => setAutoName(!autoName)}
        />
        Auto-generate name
      </label>

      <div className={styles.filterField}>
        <label htmlFor="inline-wine-color">Colour</label>
        <select
          id="inline-wine-color"
          value={form.color}
          onChange={(event) => updateField("color", event.target.value)}
        >
          {COLOR_OPTIONS.map((color) => (
            <option key={color} value={color}>
              {color}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.filterField} style={{ flex: "1 1 12rem" }}>
        <label htmlFor="inline-wine-designation">Designation (optional)</label>
        <input
          id="inline-wine-designation"
          type="text"
          value={form.designation_name}
          onChange={(event) => updateField("designation_name", event.target.value)}
          placeholder="e.g. Estate"
        />
      </div>

      <div className={styles.filterField}>
        <label htmlFor="inline-wine-year">First vintage</label>
        <input
          id="inline-wine-year"
          type="number"
          min="1900"
          max="2100"
          required={!noVintage}
          disabled={noVintage}
          value={noVintage ? currentYear() : form.vintage_year}
          onChange={(event) => updateField("vintage_year", event.target.value)}
        />
      </div>

      <label className={styles.checkboxField} htmlFor="inline-wine-nv">
        <input
          id="inline-wine-nv"
          type="checkbox"
          checked={noVintage}
          onChange={(event) => setNoVintage(event.target.checked)}
        />
        Non-vintage (NV)
      </label>

      <div className={styles.inlineFormActions}>
        <button type="submit" className="wine-btn wine-btn--primary wine-btn--lg" disabled={saving}>
          {saving ? "Creating…" : "Create wine + vintage"}
        </button>
        <button type="button" className="wine-btn wine-btn--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default InlineWineCreateForm;
