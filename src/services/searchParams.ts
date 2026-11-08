export interface SearchParams {
  [key: string]: string | number | undefined;
  query?: string;
  page?: number;
  per_page?: number;
  sort?: string;
  // additional filter keys will be added dynamically
}

/**
 * Builds a query string from SearchParams, ignoring blank/null/undefined values.
 */
export function buildQuery(params: SearchParams): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    // numbers are fine
    searchParams.append(key, String(value));
  }
  return searchParams.toString();
}

/**
 * Drops the entries that only restate a default, so a pristine listing keeps a
 * clean URL (`/reviews`) instead of one that spells the request out
 * (`/reviews?page=1&per_page=20&sort=relevance`).
 *
 * Values are compared as strings because the URL parses numbers (`page: 1`)
 * while a caller may pass either `20` or `"20"` as its default.
 */
export function pruneDefaults(
  params: SearchParams,
  defaults: SearchParams = {},
): SearchParams {
  const pruned: SearchParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === defaults[key]) continue;
    if (String(value) === String(defaults[key])) continue;
    pruned[key] = value;
  }
  return pruned;
}

/**
 * Parses a query string into SearchParams.
 * Numbers are parsed as numbers if they look like integers.
 */
export function parseQuery(searchString: string): SearchParams {
  const params: SearchParams = {};
  if (!searchString) return params;
  try {
    const searchParams = new URLSearchParams(searchString);
    for (const [key, value] of searchParams.entries()) {
      // Try to convert to number if applicable
      const num = Number(value);
      if (!isNaN(num) && value.trim() === String(num)) {
        params[key] = num;
      } else {
        params[key] = value;
      }
    }
  } catch {
    // fallback simple split
    searchString.split('&').forEach(pair => {
      const [key, val] = pair.split('=');
      if (key) {
        const decoded = decodeURIComponent(val || '');
        const num = Number(decoded);
        if (!isNaN(num) && decoded.trim() === String(num)) {
          params[key] = num;
        } else {
          params[key] = decoded;
        }
      }
    });
  }
  return params;
}

/**
 * Free-text search only runs once the term is at least this long. Shorter
 * input is treated as "no search", so the API is not hit for every keystroke
 * and a one- or two-letter term cannot blank out the listing.
 */
export const MIN_SEARCH_LENGTH = 3;

/**
 * The term that should actually be sent to the API (and used to highlight
 * matches): blank while the user has typed fewer than `min` characters.
 */
export function effectiveSearchTerm(
  value: string | number | undefined,
  min: number = MIN_SEARCH_LENGTH,
): string {
  const term = String(value ?? '').trim();
  return term.length >= min ? term : '';
}