import { useState, useEffect, useRef, useCallback } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { wineProfilesApi, tasteParametersApi } from "../services/api";
import type { WineProfileSearchResponse } from "../types/api";
import type { TasteParameter } from "../types/catalog";
import type { UserWineProfile } from "../types/user";
import type { Wine } from "../types/wine";
import { errorMessage } from "../utils/errors";
import { toStringList } from "../utils/stringList";

/** Slug -> score, the shape `calculateMatch` scores against. */
type ScoreMap = Record<string, number>;

/** A search hit: the endpoint returns wines and profiles in one response. */
type QuizHit = Wine | UserWineProfile;

/** The subset of a hit the quiz actually renders and scores. */
interface QuizSelection {
  slug: string;
  name: string | null;
  color: string | null;
  regions: string[];
  notes: string[];
  scores: ScoreMap;
}

/**
 * Normalise a hit's `parameters` into a slug -> score map.
 *
 * The two serializers disagree, and both shapes arrive in the same response:
 *   - `WineSerializer#parameters`         -> array of `{ taste_parameter_slug, score }`
 *   - `WineProfileSerializer#parameters`  -> Record `{ [slug]: score }`
 *
 * The original code called `.forEach` unconditionally, which threw a TypeError
 * whenever a *profile* was picked — every profile hit crashed the quiz.
 * Handling both shapes fixes that and leaves the wine path unchanged.
 */
function toScoreMap(hit: QuizHit): ScoreMap {
  const params = hit.parameters;
  if (Array.isArray(params)) {
    // Wine shape: WineTasteParameter[]
    return params.reduce<ScoreMap>((scores, param) => {
      scores[param.taste_parameter_slug] = param.score;
      return scores;
    }, {});
  }
  if (params && typeof params === "object") {
    // UserWineProfile shape: already a slug -> score Record.
    return { ...params };
  }
  return {};
}

/**
 * Region names for display. A `Wine` serialises `regions` as `Region[]` while a
 * `UserWineProfile` serialises them as `string[]`; the original code joined the
 * raw array, so any wine hit rendered as "[object Object]". Flattening to names
 * fixes that and leaves profile hits unchanged.
 */
function toRegionNames(hit: QuizHit): string[] {
  return toStringList(hit.regions);
}

function calculateMatch(
  selectedWineParameters: ScoreMap,
  tasteParams: TasteParameter[],
  selectedTaste: ScoreMap,
): number {
  const params = selectedWineParameters || {};
  const totalDistance = tasteParams.reduce((total, param) => {
    return (
      total +
      Math.abs((params[param.slug] ?? 3) - (selectedTaste[param.slug] ?? 3))
    );
  }, 0);
  const maxDistance = tasteParams.length * 4;
  return Math.round((1 - totalDistance / maxDistance) * 100);
}

function Quiz() {
  const [tasteParams, setTasteParams] = useState<TasteParameter[]>([]);
  const [loadingParams, setLoadingParams] = useState(true);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] =
    useState<WineProfileSearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedWine, setSelectedWine] = useState<QuizSelection | null>(null);
  const [selectedWineParameters, setSelectedWineParameters] =
    useState<ScoreMap>({});
  const [testTaste, setTestTaste] = useState<ScoreMap>({});
  const [hasSubmittedTest, setHasSubmittedTest] = useState(false);

  // Fetch taste parameters from the database
  useEffect(() => {
    async function loadParams() {
      try {
        const data = await tasteParametersApi.list();
        setTasteParams(data);
        const defaults: ScoreMap = {};
        data.forEach((p) => {
          defaults[p.slug] = 3;
        });
        setTestTaste(defaults);
      } catch {
        // silently fail
      } finally {
        setLoadingParams(false);
      }
    }
    loadParams();
  }, []);

  // Search using the same API as the main search
  const performSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setSearchResults(null);
      return;
    }
    try {
      setSearching(true);
      setError(null);
      const data = await wineProfilesApi.search(trimmed);
      setSearchResults(data);
    } catch (err) {
      setError(errorMessage(err, "Search failed"));
      setSearchResults(null);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => performSearch(value), 300);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      if (timerRef.current) clearTimeout(timerRef.current);
      performSearch(query);
    }
  }

  function selectWine(hit: QuizHit) {
    // The two serializers disagree on `parameters` *and* `notes` (a wine has an
    // array, a profile a single string), so the hit is normalised into
    // `QuizSelection` here rather than storing the raw payload.
    setSelectedWine({
      slug: hit.slug,
      name: hit.name ?? null,
      color: hit.color ?? null,
      regions: toRegionNames(hit),
      notes: toStringList(hit.notes),
      scores: toScoreMap(hit),
    });

    const defaults: ScoreMap = {};
    tasteParams.forEach((p) => {
      defaults[p.slug] = 3;
    });

    // Seed the target-answer map from the selected wine's stored profile.
    setSelectedWineParameters(toScoreMap(hit));
    setTestTaste(defaults);
    setHasSubmittedTest(false);
    setSearchResults(null);
    setQuery("");
  }

  /** `value` is the raw range input's string; the handler coerces it. */
  function handleTestTasteChange(slug: string, value: string) {
    setTestTaste((prev) => ({ ...prev, [slug]: Number(value) }));
    setHasSubmittedTest(false);
  }

  function resetTest() {
    const defaults: ScoreMap = {};
    tasteParams.forEach((p) => {
      defaults[p.slug] = 3;
    });
    setTestTaste(defaults);
    setHasSubmittedTest(false);
  }

  const testScore =
    selectedWine && tasteParams.length > 0
      ? calculateMatch(selectedWineParameters, tasteParams, testTaste)
      : 0;

  // Merge wine_profiles and wines from search results
  const allSearchHits = searchResults
    ? [...(searchResults.wine_profiles || []), ...(searchResults.wines || [])]
    : [];

  if (loadingParams) {
    return (
      <main className="wine-app quiz-page">
        <p className="wine-management__loading">Loading quiz…</p>
      </main>
    );
  }

  return (
    <main className="wine-app quiz-page">
      <section className="quiz-hero" aria-labelledby="quiz-title">
        <p className="wine-kicker">Tasting quiz</p>
        <h1 id="quiz-title">Score your read of a wine.</h1>
        <p>
          Pick a wine, set the tasting parameters as you would describe it, then
          compare your profile with the stored target values.
        </p>
      </section>

      <section
        className="wine-panel wine-test"
        aria-labelledby="wine-test-title"
      >
        <div className="section-heading">
          <p>Training mode</p>
          <h2 id="wine-test-title">Wine examples</h2>
        </div>

        <div className="wine-test__intro">
          <div className="wine-test__search-group">
            <label
              className="wine-test__search-label"
              htmlFor="quiz-wine-search"
            >
              <span>Choose a wine</span>
            </label>
            <div className="wine-test__search-wrapper">
              <input
                id="quiz-wine-search"
                className="wine-test__search-input"
                type="text"
                placeholder='e.g. "Shiraz from Barossa"…'
                value={query}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                autoComplete="off"
              />
              {searching && (
                <p className="wine-test__search-empty">Searching…</p>
              )}
              {searchResults && allSearchHits.length > 0 && !selectedWine && (
                <div className="wine-test__search-results">
                  {allSearchHits.map((hit) => (
                    <button
                      key={hit.slug || hit.name}
                      type="button"
                      className="wine-test__search-item"
                      onClick={() => selectWine(hit)}
                    >
                      <strong>{hit.name}</strong>
                      <span>
                        {[hit.color, ...toRegionNames(hit)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {searchResults && allSearchHits.length === 0 && !searching && (
                <p className="wine-test__search-empty">
                  No wines match your search.
                </p>
              )}
            </div>
          </div>

          <article className="wine-test-card">
            {selectedWine ? (
              <>
                <span>
                  {selectedWine.color || "Wine"} ·{" "}
                  {(selectedWine.regions || []).join(", ")}
                </span>
                <h3>{selectedWine.name}</h3>
                {(selectedWine.notes || []).length > 0 && (
                  <p style={{ marginTop: 4, fontSize: "0.85rem" }}>
                    {selectedWine.notes.join(", ")}
                  </p>
                )}
              </>
            ) : (
              <>
                <span>No wine selected</span>
                <h3>Search above</h3>
                <p>Type a wine name or region to begin.</p>
              </>
            )}
          </article>
        </div>

        {error && <p className="auth-form__error">{error}</p>}

        {selectedWine && (
          <div className="wine-test__grid">
            <div className="wine-sliders">
              {tasteParams.map((param) => (
                <label className="wine-slider" key={param.slug}>
                  <span className="wine-slider__top">
                    <strong>{param.label}</strong>
                    <output>{testTaste[param.slug]}</output>
                  </span>
                  <input
                    max="5"
                    min="1"
                    onChange={(event) =>
                      handleTestTasteChange(param.slug, event.target.value)
                    }
                    type="range"
                    value={testTaste[param.slug]}
                  />
                  <span className="wine-slider__scale">
                    <small>{param.low}</small>
                    <small>{param.high}</small>
                  </span>
                </label>
              ))}
            </div>

            <aside className="wine-test-result" aria-live="polite">
              <span>Your accuracy</span>
              <strong>{hasSubmittedTest ? `${testScore}%` : "--"}</strong>
              <p>
                {hasSubmittedTest
                  ? "This compares your parameter set with the stored profile for the selected wine."
                  : "Fill the sliders, then submit your tasting profile."}
              </p>

              {hasSubmittedTest && (
                <dl>
                  {tasteParams.map((param) => (
                    <div key={param.slug}>
                      <dt>{param.label}</dt>
                      <dd>
                        You {testTaste[param.slug]} / Target{" "}
                        {selectedWineParameters?.[param.slug] ?? "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              <div className="wine-test-actions">
                <button onClick={() => setHasSubmittedTest(true)} type="button">
                  Check accuracy
                </button>
                <button onClick={resetTest} type="button">
                  Try again
                </button>
              </div>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}

export default Quiz;
