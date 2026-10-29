import type { Wine } from "./wine"
import type { Review } from "./review"

/**
 * The reduced grape projection embedded in a wine payload.
 *
 * `wine_serializer` and `wine_list_serializer` both inline only
 * `{ id, name, slug, color }` (the list serializer drops `color`), never the
 * full `grape_json` — so this is deliberately *not* `GrapeDetail`, and the wine
 * screens must not expect `main_regions` / `synonyms` / counts on it.
 */
export interface GrapeRef {
  id: number
  name: string
  slug: string
  color?: string | null
}

/**
 * The payload of `GET /api/v1/grapes/:id`, which is what the detail/edit screen
 * actually edits. Spelled out rather than left to `Grape`'s index signature
 * because every field is user-editable here, and the form needs each one typed
 * (`main_regions` / `synonyms` / `notes` are the three list-valued fields the
 * `ArrayFieldInput` helper manages).
 *
 * The three list columns are required rather than optional: `grape_json` is
 * `grape.as_json`, and Rails serialises an array column as `[]` when it is
 * empty, so they are always present. The detail screen relies on that to guard
 * the lists with a single `?.length` check.
 */
export interface GrapeDetail {
  id: number
  name: string
  slug: string
  color?: string | null
  origin_country?: string | null
  main_regions: string[]
  synonyms: string[]
  is_blending_grape: boolean
  notes: string[]
  serving?: string | null
  relevance?: number | null
  wines_count: number
  producers_count: number
  regions: { id: number; name: string; slug: string }[]
}

/** One of the three "used for" flags a category can carry. */
export type CategoryFlag = "for_wine" | "for_review" | "for_article"

/**
 * The reduced projection `GET /api/v1/grapes/search` returns — a name lookup
 * with just enough context to disambiguate, not the full `grape_json`.
 */
export interface GrapeSearchResult {
  id: number
  name: string
  color?: string | null
  synonyms: string[]
}

/**
 * A category as returned by `GET /api/v1/categories`.
 *
 * The `sort_order_*` columns are per-flag: a category enabled for both wines
 * and reviews keeps a separate position in each list, which is why the admin
 * screen reorders by a column chosen from the active tab rather than by `id`.
 */
export interface Category {
  id: number
  name: string
  slug: string
  for_wine: boolean
  for_review: boolean
  for_article: boolean
  sort_order_wine: number | null
  sort_order_review: number | null
  sort_order_article: number | null
}

/** The abbreviated article shape embedded in a category's `articles` list. */
export interface CategoryArticleSummary {
  id: number
  title: string
  status: string
  author: string | null
  published_at: string | null
}

/**
 * The payload of `GET /api/v1/categories/:id`.
 *
 * Deliberately *not* `extends Category`: `show` renders only id, name, slug,
 * the three `for_*` flags and the three embedded collections — the
 * `sort_order_*` columns that `list` returns are absent, so inheriting them
 * would type them as guaranteed when they are not in the response at all.
 *
 * The embedded collections are not read by the detail screen (it fetches its own
 * paginated lists via `usePagedList`); they are described because the endpoint
 * sends them.
 */
export interface CategoryDetail {
  id: number
  name: string
  slug: string
  for_wine: boolean
  for_review: boolean
  for_article: boolean
  wines: Wine[]
  reviews: Review[]
  articles: CategoryArticleSummary[]
}

/**
 * A tasting dimension the API stores. `labels` is the server-authoritative
 * description for each integer score on the shared 1–5 tasting scale.
 */
export interface TasteParameter {
  id: number
  slug: string
  label: string
  labels: Record<string, string>
  low?: string
  high?: string
  help?: string | null
}
