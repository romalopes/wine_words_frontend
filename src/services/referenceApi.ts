import type { QueryParams, ResourceResponse } from "../types/common"
import type {
  CategoriesApi,
  CategoryCounts,
  CountriesApi,
  GrapesApi,
  RegionsApi,
  StatsApi,
  TasteParametersApi,
} from "../types/api"
import type {
  Category,
  CategoryDetail,
  GrapeDetail,
  GrapeSearchResult,
  TasteParameter,
} from "../types/catalog"
import type {
  Country,
  CountryDetail,
  CountryListItem,
  CountryRegionNode,
  Region,
  RegionDetail,
} from "../types/reference"
import type { Stats } from "../types/stats"
import type { ApiRequester } from "./apiClient"
import { buildQuery } from "./apiClient"
import { retryOnce } from "../utils/retry"

// `?page=&per_page=` etc. for the list endpoints that accept params.
function queryPath(path: string, params?: QueryParams): string {
  return `${path}${buildQuery(params ?? {})}`
}

export function createTasteParametersApi(request: ApiRequester): TasteParametersApi {
  return { list: () => request<TasteParameter[]>("/taste_parameters") }
}

export function createCategoriesApi(request: ApiRequester): CategoriesApi {
  return {
    // list/counts feed the nav on every page load; a transient boot-race 404
    // (see utils/retry) would otherwise leave the dropdowns empty until reload.
    list(type = null) {
      const params = new URLSearchParams()
      if (type) params.set("type", type)
      return retryOnce(() =>
        request<ResourceResponse<Category>>(`/categories${params.toString() ? `?${params}` : ""}`),
      )
    },
    show: (id) => request<CategoryDetail>(`/categories/${id}`, { auth: true }),
    counts: () => retryOnce(() => request<CategoryCounts>("/categories/counts")),
    create: (data) => request<Category>("/categories", { method: "POST", auth: true, body: { category: data as unknown as Record<string, never> } }),
    update: (id, data) => request<Category>(`/categories/${id}`, { method: "PATCH", auth: true, body: { category: data as unknown as Record<string, never> } }),
    remove: (id) => request(`/categories/${id}`, { method: "DELETE", auth: true }),
    reorder: (type, orderedIds) => request("/categories/reorder", { method: "PATCH", auth: true, body: { type, ordered_ids: orderedIds } }),
    linkWine: (id, wineId) => request<Category>(`/categories/${id}/link_wine`, { method: "POST", auth: true, body: { wine_id: wineId } }),
    linkProducer: (id, producerId) => request<Category>(`/categories/${id}/link_producer`, { method: "POST", auth: true, body: { producer_id: producerId } }),
    linkReview: (id, reviewId) => request<Category>(`/categories/${id}/link_review`, { method: "POST", auth: true, body: { review_id: reviewId } }),
    linkArticle: (id, articleId) => request<Category>(`/categories/${id}/link_article`, { method: "POST", auth: true, body: { article_id: articleId } }),
  }
}

export function createGrapesApi(request: ApiRequester): GrapesApi {
  return {
    list: (params?) =>
      request<ResourceResponse<GrapeDetail>>(queryPath("/grapes", params)),
    search: (query) =>
      request<GrapeSearchResult[]>(`/grapes/search?q=${encodeURIComponent(query)}`),
    show: (id) => request<GrapeDetail>(`/grapes/${id}`),
    create: (data) => request<GrapeDetail>("/grapes", { method: "POST", auth: true, body: { grape: data as unknown as Record<string, never> } }),
    update: (id, data) => request<GrapeDetail>(`/grapes/${id}`, { method: "PATCH", auth: true, body: { grape: data as unknown as Record<string, never> } }),
    remove: (id) => request(`/grapes/${id}`, { method: "DELETE", auth: true }),
    linkWine: (id, wineId) => request<GrapeDetail>(`/grapes/${id}/link_wine`, { method: "POST", auth: true, body: { wine_id: wineId } }),
    linkProducer: (id, producerId) => request<GrapeDetail>(`/grapes/${id}/link_producer`, { method: "POST", auth: true, body: { producer_id: producerId } }),
  }
}

export function createCountriesApi(request: ApiRequester): CountriesApi {
  return {
    list: (params) => request<ResourceResponse<CountryListItem>>(params?.include_wine_counts === false ? "/countries?include_wine_counts=false" : "/countries"),
    show: (id) => request<CountryDetail>(`/countries/${id}`),
    create: (data) => request<Country>("/countries", { method: "POST", auth: true, body: { country: data as unknown as Record<string, never> } }),
    update: (id, data) => request<Country>(`/countries/${id}`, { method: "PATCH", auth: true, body: { country: data as unknown as Record<string, never> } }),
    remove: (id) => request(`/countries/${id}`, { method: "DELETE", auth: true }),
    linkProducer: (id, producerId) => request<Country>(`/countries/${id}/link_producer`, { method: "POST", auth: true, body: { producer_id: producerId } }),
  }
}

export function createStatsApi(request: ApiRequester): StatsApi {
  return { get: () => request<Stats>("/stats", { auth: false }) }
}

export function createRegionsApi(request: ApiRequester): RegionsApi {
  return {
    list: () => request<Region[]>("/regions", { auth: false }),
    tree: () => request<CountryRegionNode[]>("/regions/tree", { auth: false }),
    show: (id) => request<RegionDetail>(`/regions/${id}`),
    create: (data) => request<Region>("/regions", { method: "POST", auth: true, body: { region: data as unknown as Record<string, never> } }),
    update: (id, data) => request<Region>(`/regions/${id}`, { method: "PATCH", auth: true, body: { region: data as unknown as Record<string, never> } }),
    linkWine: (id, wineId) => request<Region>(`/regions/${id}/link_wine`, { method: "POST", auth: true, body: { wine_id: wineId } }),
    linkProducer: (id, producerId) => request<Region>(`/regions/${id}/link_producer`, { method: "POST", auth: true, body: { producer_id: producerId } }),
    remove: (id) => request(`/regions/${id}`, { method: "DELETE", auth: true }),
  }
}
