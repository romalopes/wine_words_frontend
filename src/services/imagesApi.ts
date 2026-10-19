import type { ImagesApi, WineProfilesApi, WineProfileSearchResponse } from "../types/api"
import type { ImageListResponse, ImageUploadResponse } from "../types/image"
import type { UserWineProfile } from "../types/user"
import type { ApiRequester } from "./apiClient"

export function createImagesApi(request: ApiRequester): ImagesApi {
  return {
    upload(imageableType, imageableId, files) {
      const formData = new FormData()
      formData.append("imageable_type", imageableType)
      formData.append("imageable_id", String(imageableId))
      Array.from(files).forEach((file) => formData.append("images[]", file))
      return request<ImageUploadResponse>("/images", { method: "POST", auth: true, body: formData })
    },
    destroy(imageableType, imageableId, imageId) {
      return request(`/images/${imageId}?imageable_type=${imageableType}&imageable_id=${imageableId}`, { method: "DELETE", auth: true })
    },
    reorder(imageableType, imageableId, orderedIds) {
      return request<ImageListResponse>(`/images/reorder?imageable_type=${imageableType}&imageable_id=${imageableId}`, { method: "PATCH", auth: true, body: { image_ids: orderedIds } })
    },
    setPrimary(imageableType, imageableId, imageId) {
      return request<ImageListResponse>(`/images/${imageId}/primary?imageable_type=${imageableType}&imageable_id=${imageableId}`, { method: "PATCH", auth: true })
    },
  }
}

export function createWineProfilesApi(request: ApiRequester): WineProfilesApi {
  return {
    create: (profile) => request<UserWineProfile>("/wine_profiles", { method: "POST", auth: true, body: { wine_profile: profile } }),
    update: (slug, profile) => request<UserWineProfile>(`/wine_profiles/${encodeURIComponent(slug)}`, { method: "PATCH", auth: true, body: { wine_profile: profile } }),
    list: () => request<UserWineProfile[]>("/wine_profiles"),
    show: (id) => request<UserWineProfile>(`/wine_profiles/${id}`),
    search: (query, limit = 10) => request<WineProfileSearchResponse>(`/wine_profiles/search?q=${encodeURIComponent(query)}&limit=${limit}`),
  }
}
