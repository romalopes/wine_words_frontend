import type { QueryParams, ResourceResponse } from "../types/common"
import type {
  ArticleApi,
  ArticleGroup,
  ProducerApi,
  ProducerWritePayload,
  ReviewApi,
  ReviewGroup,
  ReviewWritePayload,
  SourcesApi,
  SourcesResponse,
  WineApi,
  WineGroup,
  WineSearchInput,
  WineWritePayload,
} from "../types/api"
import type { Article } from "../types/article"
import type { Producer, ProducerSearchResult } from "../types/producer"
import type { Review } from "../types/review"
import type { Wine, WineListItem } from "../types/wine"
import type { ApiRequester } from "./apiClient"
import { buildQuery } from "./apiClient"

export type { ApiRequester } from "./apiClient"

function queryPath(path: string, params?: QueryParams): string {
  return `${path}${buildQuery(params ?? {})}`
}

function advancedSearchPath(params?: QueryParams): string {
  const search = new URLSearchParams()
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== "") {
          search.append(`${key}[]`, String(item))
        }
      })
    } else {
      search.set(key, String(value))
    }
  })
  const query = search.toString()
  return `/wines/advanced_search${query ? `?${query}` : ""}`
}

export function createWinesApi(request: ApiRequester): WineApi {
  return {
    list(params) {
      return request<ResourceResponse<WineListItem>>(queryPath("/wines", params), { auth: false })
    },
    grouped(params) {
      return request<WineGroup[]>(queryPath("/wines/grouped", params), { auth: false })
    },
    search(query: string | WineSearchInput, options = {}) {
      const input = typeof query === "string" ? { q: query, ...options } : query
      const params = new URLSearchParams()
      if (input.q) params.set("q", input.q)
      if (input.producerId) params.set("producer_id", String(input.producerId))
      return request<WineListItem[]>(`/wines/search?${params.toString()}`, { auth: true })
    },
    advancedSearch(params) {
      return request<ResourceResponse<WineListItem>>(advancedSearchPath(params), { auth: false })
    },
    show(id) {
      return request<Wine>(`/wines/${id}`)
    },
    create(payload: WineWritePayload) {
      return request<Wine>("/wines", { method: "POST", auth: true, body: { wine: payload as unknown as Record<string, never> } })
    },
    update(id, payload: WineWritePayload) {
      return request<Wine>(`/wines/${id}`, { method: "PATCH", auth: true, body: { wine: payload as unknown as Record<string, never> } })
    },
    destroy(id) {
      return request(`/wines/${id}`, { method: "DELETE", auth: true })
    },
  }
}

export function createProducersApi(request: ApiRequester): ProducerApi {
  return {
    list(params) {
      return request<ResourceResponse<Producer>>(queryPath("/producers", params))
    },
    search(query) {
      return request<ProducerSearchResult[]>(`/producers/search?q=${encodeURIComponent(query)}`)
    },
    show(id) {
      return request<Producer>(`/producers/${id}`)
    },
    create(payload: ProducerWritePayload) {
      return request<Producer>("/producers", { method: "POST", auth: true, body: { producer: payload as unknown as Record<string, never> } })
    },
    update(id, payload: ProducerWritePayload) {
      return request<Producer>(`/producers/${id}`, { method: "PATCH", auth: true, body: { producer: payload as unknown as Record<string, never> } })
    },
    destroy(id) {
      return request(`/producers/${id}`, { method: "DELETE", auth: true })
    },
    uploadLogo(id, file) {
      const formData = new FormData()
      formData.append("logo", file)
      return request(`/producers/${id}/logo`, { method: "POST", auth: true, body: formData })
    },
    removeLogo(id) {
      return request(`/producers/${id}/logo`, { method: "DELETE", auth: true })
    },
    linkWine(id, wineId) {
      return request<Producer>(`/producers/${id}/link_wine`, { method: "POST", auth: true, body: { wine_id: String(wineId) } })
    },
  }
}

export function createReviewsApi(request: ApiRequester): ReviewApi {
  return {
    all(params, options) {
      return request<ResourceResponse<Review>>(queryPath("/reviews", params), { auth: true, ...options })
    },
    list(wineSlug, vintageId) {
      return request<Review[]>(`/wines/${wineSlug}/vintages/${vintageId}/reviews`, { auth: true })
    },
    show(id) {
      return request<Review>(`/reviews/${id}`, { auth: true })
    },
    create(wineSlug, vintageId, payload: ReviewWritePayload) {
      return request<Review>(`/wines/${wineSlug}/vintages/${vintageId}/reviews`, { method: "POST", auth: true, body: { review: payload as unknown as Record<string, never> } })
    },
    updateStatus(id, payload) {
      return request<void>(`/reviews/${id}`, { method: "PATCH", auth: true, headers: { Prefer: "return=minimal" }, body: { review: payload } })
    },
    update(id, payload: ReviewWritePayload) {
      return request<Review>(`/reviews/${id}`, { method: "PATCH", auth: true, body: { review: payload as unknown as Record<string, never> } })
    },
    destroy(id) {
      return request(`/reviews/${id}`, { method: "DELETE", auth: true })
    },
    myReviews() {
      return request<Review[]>("/reviews/my_reviews", { auth: true })
    },
    grouped(params, options) {
      return request<ReviewGroup[]>(queryPath("/reviews/grouped", params), { auth: true, ...options })
    },
    related(id, params, options) {
      return request<Review[]>(queryPath(`/reviews/${id}/related`, params), { auth: true, ...options })
    },
  }
}

export function createArticlesApi(request: ApiRequester): ArticleApi {
  return {
    list(params, options) {
      return request<ResourceResponse<Article>>(queryPath("/articles", params), { auth: true, ...options })
    },
    myArticles() {
      return request<Article[]>("/articles/my_articles", { auth: true })
    },
    show(id) {
      return request<Article>(`/articles/${id}`, { auth: true })
    },
    create(payload) {
      return request<Article>("/articles", { method: "POST", auth: true, body: payload instanceof FormData ? payload : { article: payload as unknown as Record<string, never> } })
    },
    updateStatus(id, payload) {
      return request<void>(`/articles/${id}`, { method: "PATCH", auth: true, headers: { Prefer: "return=minimal" }, body: { article: payload } })
    },
    update(id, payload) {
      return request<Article>(`/articles/${id}`, { method: "PATCH", auth: true, body: payload instanceof FormData ? payload : { article: payload as unknown as Record<string, never> } })
    },
    destroy(id) {
      return request(`/articles/${id}`, { method: "DELETE", auth: true })
    },
    grouped(params, options) {
      return request<ArticleGroup[]>(queryPath("/articles/grouped", params), { auth: true, ...options })
    },
    related(id, params, options) {
      return request<Article[]>(queryPath(`/articles/${id}/related`, params), { auth: true, ...options })
    },
  }
}

export function createSourcesApi(request: ApiRequester): SourcesApi {
  return {
    list() {
      return request<SourcesResponse>("/sources", { auth: true })
    },
  }
}
