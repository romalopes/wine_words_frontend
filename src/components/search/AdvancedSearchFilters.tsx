import { useEffect, useRef, useState, type FormEvent } from "react";
import nouislider from "nouislider";
import type { API as NoUiSliderAPI } from "nouislider";
import "nouislider/dist/nouislider.css";
import RegionSearch from "../RegionSearch";
import type { SelectedRegion } from "../RegionSearch";
import GrapeSearch from "../GrapeSearch";
import type { SelectedGrape } from "../GrapeSearch";
// This panel IS the /wines advanced-search visual: the wine page and the
// dashboard / reviews / articles filters share markup and stylesheet, so the
// two can never drift apart.
import styles from "../WineAdvancedSearch.module.css";

const COLORS = ["Red", "White", "Rosé", "Dessert"] as const;

// Mirrors Wine::CLOSURES (wine.rb) in the Rails API.
const CLOSURES = [
  "Cork", "Screw cap", "Diam", "Crownseal", "Synthetic",
  "Glass Stopper", "Nomacorc PlantCorc", "Vino-Lok", "Agglomerate",
] as const;

// Slugs must match Wine::TASTE_PARAMETER_FILTER_SLUGS in the API.
const TASTE_SLUGS = [
  "acidity", "alcohol-warmth", "body",
  "fruit-intensity", "sweetness", "tannin",
] as const;

type TasteSlug = (typeof TASTE_SLUGS)[number];

/** An inclusive 0-10 range per taste parameter; the extremes mean "not filtered". */
type TasteRanges = Record<TasteSlug, { min: number; max: number }>;

const TASTE_MIN = 0;
const TASTE_MAX = 10;

const DEFAULT_TASTE_RANGES: TasteRanges = Object.fromEntries(
  TASTE_SLUGS.map((slug) => [slug, { min: TASTE_MIN, max: TASTE_MAX }]),
) as TasteRanges;

/** `"some-slug"` -> `"Some Slug"`, for rendering a slug as a label. */
const humanize = (slug: string) =>
  slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/** The query both consumers receive: string fields, id lists, taste numbers. */
export type SearchParams = Record<string, string | number | number[]>;

interface AdvancedSearchFiltersProps {
  /** Pre-populates the form (e.g. the dashboard re-opening with its state). */
  initialFilters?: Record<string, any>;
  /**
   * Live param stream: fires on every field change. The dashboard and the
   * reviews / articles drawers search as-you-type; the wine page leaves it
   * unset and searches on submit instead.
   */
  onChange?: (filters: SearchParams) => void;
  /** Renders the wine-panel header (title + show/hide toggle) when set. */
  title?: string;
  /** Whether the form is expanded. Defaults to true (always expanded). */
  open?: boolean;
  onToggleOpen?: (open: boolean) => void;
  /** Renders the wine-panel action row (submit + clear) when set. */
  submitLabel?: string;
  onSubmit?: (filters: SearchParams) => void;
  /** Called after the internal Clear resets every field. */
  onClear?: () => void;
}
/**
 * The advanced search form shared by /wines, the dashboard and the
 * reviews / articles filter drawers.
 *
 * Field state is internal; every change is emitted through `onChange` (when
 * provided) as a flat, blank-stripped params object — the same shape
 * `onSubmit` receives. The visual design and the field vocabulary mirror the
 * Advanced Wine Search exactly.
 */
export function AdvancedSearchFilters({
  initialFilters = {},
  onChange,
  title,
  open: openProp,
  onToggleOpen,
  submitLabel,
  onSubmit,
  onClear,
}: AdvancedSearchFiltersProps) {
  const open = openProp ?? true;
  const [form, setForm] = useState<Record<string, any>>(initialFilters);
  const [selectedRegions, setSelectedRegions] = useState<SelectedRegion[]>([]);
  const [selectedGrapes, setSelectedGrapes] = useState<SelectedGrape[]>([]);
  // slug -> { min, max }; full-range bounds mean "not filtered".
  const [taste, setTaste] = useState<TasteRanges>(DEFAULT_TASTE_RANGES);
  const [tasteLabels, setTasteLabels] = useState<Partial<Record<TasteSlug, string>>>({});

  // Load the taste parameter catalogue once for friendly labels. The service
  // is imported lazily: this file is re-exported through the search barrel,
  // and several consumers mock `services/api` with factories that predate
  // `tasteParametersApi` — a static import would break their module load,
  // while a failed dynamic import only costs us the cosmetic labels.
  useEffect(() => {
    let cancelled = false;
    import("../../services/api")
      .then(({ tasteParametersApi }) => tasteParametersApi.list())
      .then((params) => {
        if (cancelled) return;
        const labels: Partial<Record<TasteSlug, string>> = {};
        (Array.isArray(params) ? params : []).forEach(
          (tp: { slug: string; label?: string }) => {
            labels[tp.slug as TasteSlug] = tp.label || humanize(tp.slug);
          },
        );
        setTasteLabels(labels);
      })
      .catch(() => {
        // Labels are cosmetic; the humanized slugs are the fallback.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Builds the flat params object consumers merge into their API calls. Kept
   * pure so every change path emits freshly computed values rather than a
   * stale closure snapshot. Blanks never enter `form`, and a taste slider at
   * the extremes means "not filtered" — no key is emitted for it.
   */
  function buildParams(
    nextForm: Record<string, any>,
    regions: SelectedRegion[],
    grapes: SelectedGrape[],
    nextTaste: TasteRanges,
  ): SearchParams {
    const params: SearchParams = { ...nextForm };
    if (regions.length > 0) params.region_ids = regions.map((r) => r.id);
    if (grapes.length > 0) params.grape_ids = grapes.map((g) => g.id);
    TASTE_SLUGS.forEach((slug) => {
      const range = nextTaste[slug];
      if (range.min > TASTE_MIN) params[`${slug}_min`] = range.min;
      if (range.max < TASTE_MAX) params[`${slug}_max`] = range.max;
    });
    return params;
  }

  function emit(nextForm: Record<string, any>, nextTaste: TasteRanges) {
    onChange?.(buildParams(nextForm, selectedRegions, selectedGrapes, nextTaste));
  }

  function handleInputChange(name: string, value: string | undefined) {
    const next = { ...form };
    if (value === undefined || value === "") delete next[name];
    else next[name] = value;
    setForm(next);
    emit(next, taste);
  }

  function handleRegionsChange(regions: SelectedRegion[]) {
    setSelectedRegions(regions);
    onChange?.(buildParams(form, regions, selectedGrapes, taste));
  }

  function handleGrapesChange(grapes: SelectedGrape[]) {
    setSelectedGrapes(grapes);
    onChange?.(buildParams(form, selectedRegions, grapes, taste));
  }

  /**
   * A taste slider moved. The slider reports the complete new pair (it never
   * lets the lower handle cross the upper one), so the values are taken
   * straight from the event rather than clamped against possibly-stale state.
   */
  function handleTasteChange(slug: TasteSlug, range: { min: number; max: number }) {
    const nextTaste = { ...taste, [slug]: range };
    setTaste(nextTaste);
    onChange?.(buildParams(form, selectedRegions, selectedGrapes, nextTaste));
  }

  /** The wine-panel Clear: reset every field, then tell the parent. */
  function handleClear() {
    setForm({});
    setSelectedRegions([]);
    setSelectedGrapes([]);
    setTaste(DEFAULT_TASTE_RANGES);
    onClear?.();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit?.(buildParams(form, selectedRegions, selectedGrapes, taste));
  }

  return (
    <div className={styles.panel}>
      {title !== undefined && (
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button
            type="button"
            className={`${styles.toggleBtn} ${open ? styles.toggleBtnActive : ""}`}
            onClick={() => onToggleOpen?.(!open)}
          >
            {open ? "Hide form" : "Show form"}
          </button>
        </div>
      )}

      {open && (
        <form onSubmit={handleSubmit}>
          <fieldset className={styles.section}>
            <div className={styles.grid}>
              <span className={styles.sectionTitle}>Wine</span>
              <div className={styles.field}>
                <label className={styles.label}>Name of wine</label>
                <input
                  className={styles.input}
                  type="text"
                  name="name"
                  value={form.name ?? ""}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="e.g. Bin 389"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Name of producer</label>
                <input
                  className={styles.input}
                  type="text"
                  name="producer_name"
                  value={form.producer_name ?? ""}
                  onChange={(e) => handleInputChange("producer_name", e.target.value)}
                  placeholder="e.g. Penfolds"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Color</label>
                <select
                  className={styles.select}
                  name="color"
                  value={form.color ?? ""}
                  onChange={(e) => handleInputChange("color", e.target.value)}
                  aria-label="Color"
                >
                  <option value="">Any</option>
                  {COLORS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Type of closure</label>
                <select
                  className={styles.select}
                  name="closure"
                  value={form.closure ?? ""}
                  onChange={(e) => handleInputChange("closure", e.target.value)}
                  aria-label="Type of closure"
                >
                  <option value="">Any</option>
                  {CLOSURES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.rows}>
              {rangeRow("alcohol", "Alcohol %", undefined, { step: 0.1, ariaLabel: "Alcohol" })}

              <div className={styles.row}>
                <div className={styles.rowLabel}>Style</div>
                <div className={styles.rowInputs}>
                  <div className={`${styles.checkboxRow} ${styles.wideControl}`}>
                    {triSelect("sparkling", "Sparkling")}
                    {triSelect("fortified", "Fortified")}
                  </div>
                </div>
              </div>
            </div>

            <span className={styles.sectionTitle}>Vintages & reviews</span>
            <div className={styles.rows}>
              {rangeRow("vintage_year", "Vintage year", undefined, { step: 1, min: 1900 })}
              {rangeRow("price", "Price of vintage", "currency", { step: "0.01", min: 0 })}
              {rangeRow("score", "Review score", "0-100", { step: 0.5, min: 0, max: 100 })}
              {rangeRow("drink_from", "Drink from", "year", { step: 1 })}
              {rangeRow("drink_to", "Drink to", "year", { step: 1 })}

              <div className={styles.row}>
                <div className={styles.rowLabel}>Review published between</div>
                <div className={styles.rowInputs}>
                  <input
                    className={`${styles.input} ${styles.inputMin}`}
                    type="date"
                    name="published_from"
                    value={form.published_from ?? ""}
                    onChange={(e) => handleInputChange("published_from", e.target.value)}
                    aria-label="Published from"
                  />
                  <span className={styles.dateSeparator}>→</span>
                  <input
                    className={`${styles.input} ${styles.inputMax}`}
                    type="date"
                    name="published_to"
                    value={form.published_to ?? ""}
                    onChange={(e) => handleInputChange("published_to", e.target.value)}
                    aria-label="Published to"
                  />
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.rowLabel}>Country or Region</div>
                <div className={styles.rowInputs}>
                  <div className={styles.wideControl}>
                    <RegionSearch selected={selectedRegions} onChange={handleRegionsChange} />
                  </div>
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.rowLabel}>Grape</div>
                <div className={styles.rowInputs}>
                  <div className={styles.wideControl}>
                    <GrapeSearch selected={selectedGrapes} onChange={handleGrapesChange} />
                  </div>
                </div>
              </div>
            </div>

            <TasteParameterRanges taste={taste} labels={tasteLabels} onChange={handleTasteChange} />
          </fieldset>

          {submitLabel && onSubmit && (
            <div className={styles.actions}>
              <button type="submit" className={styles.searchBtn}>
                {submitLabel}
              </button>
              <button type="button" className={styles.clearBtn} onClick={handleClear}>
                Clear
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );

  /**
   * One min/max row, visually identical to the wine panel: the "Min"/"Max"
   * captions sit in their own grid columns, and every input carries a distinct
   * accessible name. `ariaLabel` overrides the visible label for the
   * accessible names — the hint text ("(currency)", "(year)") must never leak
   * into them.
   */
  function rangeRow(
    base: string,
    label: string,
    hint?: string,
    extra: {
      step?: string | number;
      min?: number;
      max?: number;
      ariaLabel?: string;
    } = {},
  ) {
    const ariaBase = extra.ariaLabel ?? label;
    const minProps = {
      ...(extra.min !== undefined ? { min: extra.min } : {}),
      ...(extra.max !== undefined ? { max: extra.max } : {}),
    };
    return (
      <div key={base} className={styles.row}>
        <div className={styles.rowLabel}>
          {label}
          {hint && (
            <>
              {" "}
              <span className={styles.labelSub}>({hint})</span>
            </>
          )}
        </div>
        <div className={styles.rowInputs}>
          <span className={`${styles.miniLabel} ${styles.miniMin}`}>Min</span>
          <input
            className={`${styles.input} ${styles.inputMin}`}
            type="number"
            step={extra.step ?? 1}
            {...minProps}
            name={`${base}_min`}
            value={form[`${base}_min`] ?? ""}
            onChange={(e) => handleInputChange(`${base}_min`, e.target.value || undefined)}
            placeholder="Min"
            aria-label={`${ariaBase} minimum`}
          />
          <span className={`${styles.miniLabel} ${styles.miniMax}`}>Max</span>
          <input
            className={`${styles.input} ${styles.inputMax}`}
            type="number"
            step={extra.step ?? 1}
            {...minProps}
            name={`${base}_max`}
            value={form[`${base}_max`] ?? ""}
            onChange={(e) => handleInputChange(`${base}_max`, e.target.value || undefined)}
            placeholder="Max"
            aria-label={`${ariaBase} maximum`}
          />
        </div>
      </div>
    );
  }

  /**
   * The three-valued style selects ("", "true", "false"): "" means "ignore",
   * exactly like the /wines advanced search.
   */
  function triSelect(name: string, labelText: string) {
    return (
      <label key={name} className={styles.checkbox}>
        {labelText}
        <select
          className={styles.select}
          name={name}
          value={form[name] ?? ""}
          onChange={(e) => handleInputChange(name, e.target.value)}
          style={{ width: "auto" }}
        >
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </label>
    );
  }
}

/**
 * One dual-thumb noUiSlider for a taste parameter.
 *
 * The slider is created once per parameter; the latest callback and range are
 * kept in refs so re-renders never re-create (and interrupt) a drag. The
 * change callback reports the complete new `{min, max}` pair read from the
 * slider itself, so the parent never clamps against possibly-stale state.
 */
function TasteParameterSlider({
  slug,
  label,
  range,
  onChange,
}: {
  slug: TasteSlug;
  label: string;
  range: { min: number; max: number };
  onChange: (slug: TasteSlug, range: { min: number; max: number }) => void;
}) {
  const sliderRef = useRef<HTMLDivElement>(null);
  // The live nouislider instance, so external state changes can be pushed in.
  const sliderInstanceRef = useRef<NoUiSliderAPI | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const rangeRef = useRef(range);
  rangeRef.current = range;

  useEffect(() => {
    if (!sliderRef.current) return;
    const instance = nouislider.create(sliderRef.current, {
      start: [rangeRef.current.min, rangeRef.current.max],
      connect: true,
      range: { min: TASTE_MIN, max: TASTE_MAX },
      step: 1,
      // Show plain integers rather than the default "3.00" formatting.
      format: { to: (value) => String(Math.round(Number(value))), from: Number },
      tooltips: false,
      // Label each handle for screen readers. nouislider already adds
      // role="slider", tabindex and the aria-value* attributes.
      handleAttributes: [
        { "aria-label": `${label} minimum` },
        { "aria-label": `${label} maximum` },
      ],
    });
    // "update" fires continuously while dragging; the guard drops echoes of
    // our own programmatic `set()` calls and of values the parent knows.
    instance.on(
      "update",
      (_values: (string | number)[], _handle: number, unencoded: number[]) => {
        const nextMin = Math.round(Number(unencoded[0]));
        const nextMax = Math.round(Number(unencoded[1]));
        const current = rangeRef.current;
        if (nextMin !== current.min || nextMax !== current.max) {
          onChangeRef.current(slug, { min: nextMin, max: nextMax });
        }
      },
    );
    sliderInstanceRef.current = instance;
    return () => {
      sliderInstanceRef.current = null;
      instance.destroy();
    };
    // Created once per parameter; later position changes flow through the
    // sync effect below.
  }, [slug, label]);

  // Push external changes back into the slider. `get(true)` returns raw
  // numbers, unlike `get()` which returns formatted strings.
  useEffect(() => {
    const instance = sliderInstanceRef.current;
    if (!instance) return;
    const current = instance.get(true) as number[];
    if (current[0] !== range.min || current[1] !== range.max) {
      instance.set([range.min, range.max]);
    }
  }, [range.min, range.max]);

  return <div className={styles.tasteSlider} ref={sliderRef} />;
}

/** Sliders for the six searchable taste parameters (0-10 scale). */
function TasteParameterRanges({
  taste,
  labels,
  onChange,
}: {
  taste: TasteRanges;
  labels: Partial<Record<TasteSlug, string>>;
  onChange: (slug: TasteSlug, range: { min: number; max: number }) => void;
}) {
  return (
    <div className={styles.tasteSection}>
      <span className={styles.sectionTitle}>
        Taste parameters{" "}
        <span className={styles.labelSub}>
          (move a slider to filter — score 0-10)
        </span>
      </span>
      <div className={styles.tasteGrid}>
        {TASTE_SLUGS.map((slug) => {
          const range = taste[slug];
          const active = range.min > TASTE_MIN || range.max < TASTE_MAX;
          const label = labels[slug] || humanize(slug);
          return (
            <div
              key={slug}
              className={styles.tasteItem}
              style={active ? { borderColor: "#8a5a44" } : undefined}
            >
              <div className={styles.tasteHead}>
                <span className={styles.tasteName}>
                  {label}
                  {active && <span className={styles.tasteActive}> ✓</span>}
                </span>
                <span className={styles.tasteValue}>
                  {range.min} – {range.max}
                </span>
              </div>
              <TasteParameterSlider
                slug={slug}
                label={label}
                range={range}
                onChange={onChange}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AdvancedSearchFilters;