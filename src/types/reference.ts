/**
 * A country as returned by `GET /api/v1/countries` (index) and
 * `GET /api/v1/countries/:id` (show). Both return the country's own fields
 * only; `index` additionally carries computed counts (`CountryListItem`).
 */
export interface Country {
  id: number
  name: string
  slug: string
  code?: string | null
  continent?: string | null
  flag_emoji?: string | null
  is_wine_country?: boolean | null
}

/** A country from the `index` endpoint, with producer counts and optional wine counts. */
export interface CountryListItem extends Country {
  producers_count: number
  wines_count?: number
}

/**
 * `GET /api/v1/countries/:id`. Lean by design: producers and wines are fetched
 * separately via the paginated `/api/v1/producers?country_id=...` and
 * `/api/v1/wines?country_id=...` lists, so the show payload carries no
 * embedded rows.
 */
export interface CountryDetail extends Country {}

/**
 * A region as returned by `GET /api/v1/regions` and by the create/update
 * endpoints (all four share `region_json`).
 */
export interface Region {
  id: number
  name: string
  slug: string
  country_id?: number | null
  country?: Country | null
  parent_id?: number | null
  /** Denormalised for display — not a column on `regions`. */
  parent_name?: string | null
  is_state?: boolean | null
  is_appellation?: boolean | null
}

/**
 * One crumb of `Region#full_path`: the country first, then each ancestor
 * region down to the region itself. A discriminated union on `type` because
 * the two variants genuinely differ — only the country carries `flag_emoji`
 * and `code`.
 */
export type RegionPathCrumb =
  | {
      type: "country"
      id: number
      slug: string
      name: string
      // `| undefined` is accepted explicitly so a value read off an optional
      // API field can be assigned without a separate spread (see
      // `exactOptionalPropertyTypes`).
      flag_emoji?: string | null | undefined
      code?: string | null | undefined
    }
  | {
      type: "region"
      id: number
      slug: string
      name: string
      is_state?: boolean | null | undefined
      is_appellation?: boolean | null | undefined
      parent_id?: number | null | undefined
    }

/** `GET /api/v1/regions/:id` — `region_json` plus the computed `full_path`.
 * Also returned by `link_wine`. Wines are fetched separately via
 * `GET /api/v1/wines?region_id=...` (paginated), so they are not embedded. */
export interface RegionDetail extends Region {
  full_path?: RegionPathCrumb[] | null
}

/** One node of `GET /api/v1/regions/tree`. `wine_count` includes children. */
export interface RegionTreeNode {
  id: number
  name: string
  slug: string
  is_state?: boolean | null
  is_appellation?: boolean | null
  parent_id?: number | null
  /**
   * Not a `build_tree_nodes` key — the country is the enclosing node. Declared
   * so the edit form can prefill `country_id`; the tree page reads it off the
   * country it is rendering rather than from here.
   */
  country_id?: number | null
  /** Direct wines plus the summed count of every descendant. */
  wine_count: number
  children: RegionTreeNode[]
}

/** The tree endpoint's top level: one entry per country, regions nested. */
export interface CountryRegionNode {
  id: number
  name: string
  slug: string
  code?: string | null
  flag_emoji?: string | null
  continent?: string | null
  wine_count: number
  regions: RegionTreeNode[]
}

