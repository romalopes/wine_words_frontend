import { useEffect, useState, type ChangeEvent } from "react";
import type { Region } from "../types/reference";
import { regionsApi } from "../services/api"


/** A region the user has attached to a wine, as carried by the tag list. */
export interface SelectedRegion {
  id: number
  name: string
}

interface RegionSearchProps {
  selected: SelectedRegion[]
  onChange: (regions: SelectedRegion[]) => void
  countryId?: number | null
}


// Region picker used in the wine form. Searches regions by name and/or country.
// Loads the full list once, then filters client-side; allows adding multiple
// regions to a wine, shown as removable tags.
// When `countryId` is provided, only regions of that country are selectable.
function RegionSearch({ selected, onChange, countryId }: RegionSearchProps) {
  const [query, setQuery] = useState("");
  const [allRegions, setAllRegions] = useState<Region[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSearching(true);
    regionsApi
      .list()
      .then((data) => {
        if (!cancelled) setAllRegions(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setAllRegions([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed.length >= 2
    ? allRegions.filter(
        (r) =>
          (countryId == null ||
            (r.country && String(r.country.id) === String(countryId))) &&
          ((r.name || "").toLowerCase().includes(trimmed) ||
            (r.country?.name || "").toLowerCase().includes(trimmed)),
      )
    : [];

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
  }

  function handleSelect(region: Region) {
    if (!selected.some((r) => r.id === region.id)) {
      // Keep the selected value equal to the canonical catalogue name. Consumers
      // such as WineProfileForm submit this field to APIs that resolve regions
      // by name, so display-only country metadata must not become part of it.
      onChange([...selected, { id: region.id, name: region.name }]);
    }
    setQuery("");
  }

  function handleRemove(id: number) {
    onChange(selected.filter((r) => r.id !== id));
  }

  return (
    <div className="producer-search">
      <span>Regions</span>
      {selected.length > 0 && (
        <div className="grape-search__selected">
          {selected.map((region) => (
            <span key={region.id} className="grape-tag">
              {region.name}
              <button
                type="button"
                className="wine-form__remove-vintage"
                onClick={() => handleRemove(region.id)}
                title={`Remove ${region.name}`}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        placeholder="Start typing a region name…"
        autoComplete="off"
      />
      {searching && <p className="wine-management__loading">Searching…</p>}
      {!searching && filtered.length > 0 && trimmed.length >= 2 && (
        <div className="review-list">
          {filtered.map((region) => (
            <button
              key={region.id}
              type="button"
              className="review-card"
              onClick={() => handleSelect(region)}
            >
              <strong>{region.name}</strong>
              {region.country && (
                <span>
                  {" "}
                  ({region.country.flag_emoji} {region.country.name})
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {!searching && trimmed.length >= 2 && filtered.length === 0 && (
        <p className="wine-management__empty-state">No regions found.</p>
      )}
    </div>
  );
}

export default RegionSearch;