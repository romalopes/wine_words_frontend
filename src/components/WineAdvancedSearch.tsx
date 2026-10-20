import { useEffect, useState, useRef } from "react";
import type { ChangeEvent, FormEvent } from "react";
import RegionSearch from "./RegionSearch";
import type { SelectedRegion } from "./RegionSearch";
import GrapeSearch from "./GrapeSearch";
import type { SelectedGrape } from "./GrapeSearch";
import { tasteParametersApi } from "../services/api";
import styles from "./WineAdvancedSearch.module.css";
import nouislider from "nouislider";
import type { API as NoUiSliderAPI } from "nouislider";
import "nouislider/dist/nouislider.css";

// Mirrors Wine::COLORS and Wine::CLOSURES (wine.rb) in the Rails API.
const COLORS = ["Red", "White", "Rosé", "Dessert"];
const CLOSURES = [
  "Cork", "Screw cap", "Diam", "Crownseal", "Synthetic",
  "Glass Stopper", "Nomacorc PlantCorc", "Vino-Lok", "Agglomerate",
] as const;

// Slugs must match Wine::TASTE_PARAMETER_FILTER_SLUGS in the API.
const TASTE_SLUGS = [
  "acidity", "alcohol-warmth", "body",
  "fruit-intensity", "sweetness", "tannin",
] as const;

const TASTE_MIN = 0;
const TASTE_MAX = 10;

const DEFAULT_TASTE_RANGES: TasteRanges = Object.fromEntries(
  TASTE_SLUGS.map(slug => [slug, { min: TASTE_MIN, max: TASTE_MAX }])
);

type TasteSlug = (typeof TASTE_SLUGS)[number];

/** Which end of a taste range a slider moved. */
type TasteBound = "min" | "max";

/** An inclusive 0-10 range per taste parameter. */
type TasteRanges = Partial<Record<TasteSlug, { min: number; max: number }>>;

/**
 * Every field is a string because it is bound directly to an <input>; the API
 * layer decides which keys to coerce to numbers. The three-valued selects
 * (sparkling / fortified) use "" for "ignore".
 */
const EMPTY_FORM = {
  name: "", producer_name: "", score_min: "", score_max: "",
  vintage_year_min: "", vintage_year_max: "", published_from: "", published_to: "",
  closure: "", color: "", price_min: "", price_max: "",
  drink_from_min: "", drink_from_max: "", drink_to_min: "", drink_to_max: "",
  alcohol_min: "", alcohol_max: "",
  sparkling: "", // "", "true", "false" — "" means "ignore"
  fortified: "",
};

/** The bound-input keys, derived from EMPTY_FORM so the two cannot drift. */
type SearchFormField = keyof typeof EMPTY_FORM;
type SearchForm = Record<SearchFormField, string>;

/**
 * The query the search actually runs. Blanks are stripped, so this is a mix of
 * the string form fields, the numeric taste ranges, and the id lists chosen
 * through the region / grape pickers.
 */
export type SearchParams = Record<
  string,
  string | number | number[]
>;

/** `"some-slug"` -> `"Some Slug"`, for rendering a slug as a label. */
const humanize = (slug: string) =>
  slug
    .split("-")
    // Capitalise the first character of each part. `charAt` is used rather than
    // indexing because indexing a `string` yields `string | undefined` under
    // `noUncheckedIndexedAccess`.
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

function TasteParameterSlider({ slug, label, range, onChange }: { slug: TasteSlug; label: string; range: { min: number; max: number }; onChange: (slug: TasteSlug, bound: "min" | "max", value: number) => void }) {
  const sliderRef = useRef<HTMLDivElement>(null);
  // The live nouislider instance, so external state changes (e.g. "Clear")
  // can be pushed into the slider.
  const sliderInstanceRef = useRef<NoUiSliderAPI | null>(null);
  // Keep the latest callback and range in refs so the slider only has to be
  // created once; re-creating it on every change would make the thumb flicker
  // and interrupt the drag.
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
    // "update" fires continuously while dragging, so the read-out tracks the
    // thumb in real time. The guard drops echoes of our own programmatic
    // `set()` calls and of values the parent already knows about.
    instance.on("update", (_values: (string | number)[], _handle: number, unencoded: number[]) => {
      const current = rangeRef.current;
      const nextMin = Math.round(Number(unencoded[0]));
      const nextMax = Math.round(Number(unencoded[1]));
      if (nextMin !== current.min) onChangeRef.current(slug, "min", nextMin);
      if (nextMax !== current.max) onChangeRef.current(slug, "max", nextMax);
    });
    sliderInstanceRef.current = instance;
    return () => {
      sliderInstanceRef.current = null;
      instance.destroy();
    };
    // The slider is created once per parameter; the initial position is read
    // from `rangeRef` and kept in sync by the effect below.
  }, [slug, label]);

  // Push external changes (e.g. "Clear") back into the slider. `get(true)`
  // returns the raw numeric values, unlike `get()` which returns formatted
  // strings and would never compare equal to the numbers in state.
  useEffect(() => {
    const instance = sliderInstanceRef.current;
    if (!instance) return;
    const current = instance.get(true) as number[];
    if (current[0] !== range.min || current[1] !== range.max) {
      instance.set([range.min, range.max]);
    }
  }, [range.min, range.max]);

  return (
    <div className={styles.tasteSlider} ref={sliderRef} />
  );
}

// Sliders for the six searchable taste parameters (0-10 scale). Sliders at
// the extremes mean the parameter is not filtered.
interface TasteParameterRangesProps {
  taste: TasteRanges
  labels: Partial<Record<TasteSlug, string>>
  onChange: (slug: TasteSlug, bound: TasteBound, value: number) => void
}

function TasteParameterRanges({ taste, labels, onChange }: TasteParameterRangesProps) {
  return (
    <div className={styles.tasteSection}>
      <span className={styles.sectionTitle}>
        Taste parameters <span className={styles.labelSub}>(move a slider to filter — score 0-10)</span>
      </span>
      <div className={styles.tasteGrid}>
        {TASTE_SLUGS.map((slug) => {
          const range = taste[slug] ?? { min: TASTE_MIN, max: TASTE_MAX };
          const active = range.min > TASTE_MIN || range.max < TASTE_MAX;
          const label = labels[slug] || humanize(slug);
          return (
            <div key={slug} className={styles.tasteItem} style={active ? { borderColor: "#8a5a44" } : undefined}>
              <div className={styles.tasteHead}>
                <span className={styles.tasteName}>
                  {label}{active && <span className={styles.tasteActive}> ✓</span>}
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

/** The `base` names that pair into `<base>_min` / `<base>_max` form keys. */
type SearchRangeBase =
  | "score" | "vintage_year" | "price" | "drink_from" | "drink_to" | "alcohol";

// Min/max numeric range field pair for `base` + "_min" / "_max" form keys.
interface RangeFieldProps {
  base: SearchRangeBase
  label: string
  hint?: string
  form: SearchForm
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  // `step` is `string | number` to match React's own input attribute typing —
  // the price range passes "0.01" so the browser keeps full precision.
  step?: number | string
  min?: number
  max?: number
}

function RangeField({ base, label, hint, form, onChange, ...inputProps }: RangeFieldProps) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>
        {label} {hint && <span className={styles.labelSub}>({hint})</span>}
      </div>
      <div className={styles.rowInputs}>
        {/* The visible "Min"/"Max" texts are plain spans, not <label>s: several
            ranges would otherwise all expose an identical "Min" accessible
            name. The inputs carry a label naming their own range instead. */}
        <span className={`${styles.miniLabel} ${styles.miniMin}`}>Min</span>
        <input className={`${styles.input} ${styles.inputMin}`} type="number" name={`${base}_min`}
          aria-label={`${label} minimum`}
          value={form[`${base}_min`]} onChange={onChange} {...inputProps} />
        <span className={`${styles.miniLabel} ${styles.miniMax}`}>Max</span>
        <input className={`${styles.input} ${styles.inputMax}`} type="number" name={`${base}_max`}
          aria-label={`${label} maximum`}
          value={form[`${base}_max`]} onChange={onChange} {...inputProps} />
      </div>
    </div>
  );
}

// Complex search form for the wines page. Every field is optional; blank
// values are stripped before the search runs.
interface WineAdvancedSearchProps {
  /** Called with the assembled (blank-stripped) query when the form submits. */
  onSearch: (params: SearchParams) => void
  onClear: () => void
  open: boolean
  onToggleOpen: (open: boolean) => void
}

export default function WineAdvancedSearch({ onSearch, onClear, open, onToggleOpen }: WineAdvancedSearchProps) {
  const [form, setForm] = useState<SearchForm>(EMPTY_FORM);
  const [selectedRegions, setSelectedRegions] = useState<SelectedRegion[]>([]);
  const [selectedGrapes, setSelectedGrapes] = useState<SelectedGrape[]>([]);
  // slug -> { min, max }; full-range bounds mean "not filtered".
  const [taste, setTaste] = useState<TasteRanges>(DEFAULT_TASTE_RANGES);
  const [tasteLabels, setTasteLabels] = useState<Partial<Record<TasteSlug, string>>>({});

  // Load the taste parameter catalogue once for friendly labels.
  useEffect(() => {
    let cancelled = false;
    tasteParametersApi.list().then((params) => {
      if (cancelled) return;
      const labels: Partial<Record<TasteSlug, string>> = {};
      (Array.isArray(params) ? params : []).forEach((tp) => {
        labels[tp.slug as TasteSlug] = tp.label || humanize(tp.slug);
      });
      setTasteLabels(labels);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleTasteChange = (
    slug: TasteSlug,
    bound: TasteBound,
    value: number
  ) => {
    setTaste(prev => {
      const prevRange = prev[slug] ?? { min: TASTE_MIN, max: TASTE_MAX };
      let newMin = prevRange.min;
      let newMax = prevRange.max;
      if (bound === "min") {
        // Clamp min so it never goes above the current max
        newMin = Math.min(value, prevRange.max);
      } else {
        // Clamp max so it never goes below the current min
        newMax = Math.max(value, prevRange.min);
      }
      return {
        ...prev,
        [slug]: { min: newMin, max: newMax },
      };
    });
  };

  function handleClear() {
    setForm(EMPTY_FORM);
    setSelectedRegions([]);
    setSelectedGrapes([]);
    setTaste(DEFAULT_TASTE_RANGES);
    onClear();
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Strip every blank value: only non-empty fields become query params.
    const params = Object.fromEntries(
      Object.entries(form).filter(([, v]) => v !== "" && v != null),
    ) as SearchParams;
    if (selectedRegions.length > 0) params.region_ids = selectedRegions.map((r) => r.id);
    if (selectedGrapes.length > 0) params.grape_ids = selectedGrapes.map((g) => g.id);
    TASTE_SLUGS.forEach((slug) => {
      const range = taste[slug];
      if (!range) return;
      if (range.min > TASTE_MIN) params[`${slug}_min`] = range.min;
      if (range.max < TASTE_MAX) params[`${slug}_max`] = range.max;
    });
    onSearch(params);
    onToggleOpen(false);
  }

  const numRange = (
    base: SearchRangeBase,
    label: string,
    hint: string,
    extra: Partial<Omit<RangeFieldProps, "base" | "form" | "onChange">> = {},
  ) => (
    <RangeField key={base} base={base} label={label} hint={hint} form={form} onChange={handleChange} {...extra} />
  );

  const triSelect = (name: SearchFormField, label: string) => (
    <label key={name} className={styles.checkbox}>
      {label}
      <select className={styles.select} name={name} value={form[name]} onChange={handleChange} style={{ width: "auto" }}>
        <option value="">Any</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </label>
  );

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Advanced Wine Search</h2>
        <button type="button"
          className={`${styles.toggleBtn} ${open ? styles.toggleBtnActive : ""}`}
          onClick={() => onToggleOpen(!open)}>
          {open ? "Hide form" : "Show form"}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSubmit}>
          <fieldset className={styles.section}>
            <div className={styles.grid}>
              <span className={styles.sectionTitle}>Wine</span>
              <div className={styles.field}>
                <label className={styles.label}>Name of wine</label>
                <input className={styles.input} type="text" name="name" value={form.name}
                  onChange={handleChange} placeholder="e.g. Bin 389" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Name of producer</label>
                <input className={styles.input} type="text" name="producer_name" value={form.producer_name}
                  onChange={handleChange} placeholder="e.g. Penfolds" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Color</label>
                <select className={styles.select} name="color" value={form.color} onChange={handleChange}>
                  <option value="">Any</option>
                  {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Type of closure</label>
                <select className={styles.select} name="closure" value={form.closure} onChange={handleChange}>
                  <option value="">Any</option>
                  {CLOSURES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className={styles.rows}>
              <div className={styles.row}>
                <div className={styles.rowLabel}>Alcohol %</div>
                <div className={styles.rowInputs}>
                  <span className={`${styles.miniLabel} ${styles.miniMin}`}>Min</span>
                  <input className={`${styles.input} ${styles.inputMin}`} type="number" step="0.1" name="alcohol_min"
                    aria-label="Alcohol minimum" value={form.alcohol_min}
                    onChange={handleChange} placeholder="Min" />
                  <span className={`${styles.miniLabel} ${styles.miniMax}`}>Max</span>
                  <input className={`${styles.input} ${styles.inputMax}`} type="number" step="0.1" name="alcohol_max"
                    aria-label="Alcohol maximum" value={form.alcohol_max}
                    onChange={handleChange} placeholder="Max" />
                </div>
              </div>

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

            <span className={styles.sectionTitle}>Vintages &amp; reviews</span>
            <div className={styles.rows}>
              {numRange("vintage_year", "Vintage year", "", { step: 1, min: 1900 })}
              {numRange("price", "Price of vintage", "currency", { step: "0.01", min: 0 })}
              {numRange("score", "Review score", "0-100", { step: 0.5, min: 0, max: 100 })}
              {numRange("drink_from", "Drink from", "year", { step: 1 })}
              {numRange("drink_to", "Drink to", "year", { step: 1 })}

              <div className={styles.row}>
                <div className={styles.rowLabel}>Review published between</div>
                <div className={styles.rowInputs}>
                  <input className={`${styles.input} ${styles.inputMin}`} type="date" name="published_from" value={form.published_from}
                    onChange={handleChange} aria-label="Published from" />
                  <span className={styles.dateSeparator}>→</span>
                  <input className={`${styles.input} ${styles.inputMax}`} type="date" name="published_to" value={form.published_to}
                    onChange={handleChange} aria-label="Published to" />
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.rowLabel}>Country or Region</div>
                <div className={styles.rowInputs}>
                  <div className={styles.wideControl}>
                    <RegionSearch selected={selectedRegions} onChange={setSelectedRegions} />
                  </div>
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.rowLabel}>Grape</div>
                <div className={styles.rowInputs}>
                  <div className={styles.wideControl}>
                    <GrapeSearch selected={selectedGrapes} onChange={setSelectedGrapes} />
                  </div>
                </div>
              </div>
            </div>

            <TasteParameterRanges taste={taste} labels={tasteLabels} onChange={handleTasteChange} />
          </fieldset>

          <div className={styles.actions}>
            <button type="submit" className={styles.searchBtn}>Search wines</button>
            <button type="button" className={styles.clearBtn} onClick={handleClear}>Clear</button>
          </div>
        </form>
      )}
    </div>
  );
}
