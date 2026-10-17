import type { QueryParams, ResourceResponse } from "../types/common"
import type {
  NotificationsApi,
  ShipmentTrackingsApi,
  ShipmentTrackingWritePayload,
  WinePackageActionPayload,
  WinePackageItemWritePayload,
  WinePackageItemsApi,
  WinePackagesApi,
  WinePackageWritePayload,
} from "../types/api"
import type { Notification } from "../types/notification"
import type { Review } from "../types/review"
import type { ShipmentTracking } from "../types/shipmentTracking"
import type { WinePackage, WinePackageItem, WinePackageListItem } from "../types/winePackage"
import type { ApiRequester } from "./apiClient"
import { buildQuery } from "./apiClient"

export type { ApiRequester } from "./apiClient"

function queryPath(path: string, params?: QueryParams): string {
  return `${path}${buildQuery(params ?? {})}`
}

export function createWinePackagesApi(request: ApiRequester): WinePackagesApi {
  return {
    list(params) {
      // `#index` is served by the lean WinePackageListSerializer, not the full one.
      return request<ResourceResponse<WinePackageListItem>>(queryPath("/wine_packages", params), { auth: true })
    },
    show(id) {
      return request<WinePackage>(`/wine_packages/${id}`, { auth: true })
    },
    create(payload: WinePackageWritePayload) {
      return request<WinePackage>("/wine_packages", { method: "POST", auth: true, body: { wine_package: payload as unknown as Record<string, never> } })
    },
    update(id, payload: WinePackageWritePayload) {
      return request<WinePackage>(`/wine_packages/${id}`, { method: "PATCH", auth: true, body: { wine_package: payload as unknown as Record<string, never> } })
    },
    destroy(id) {
      return request(`/wine_packages/${id}`, { method: "DELETE", auth: true })
    },
    markArrived(id, payload: WinePackageActionPayload = {}) {
      return request<WinePackage>(`/wine_packages/${id}/mark_arrived`, { method: "POST", auth: true, body: payload as unknown as Record<string, never> })
    },
    markInTransit(id) {
      return request<WinePackage>(`/wine_packages/${id}/mark_in_transit`, { method: "POST", auth: true })
    },
    markCompleted(id, payload: WinePackageActionPayload = {}) {
      return request<WinePackage>(`/wine_packages/${id}/mark_completed`, { method: "POST", auth: true, body: payload as unknown as Record<string, never> })
    },
    reopen(id) {
      return request<WinePackage>(`/wine_packages/${id}/reopen`, { method: "POST", auth: true })
    },
    cancel(id) {
      return request<WinePackage>(`/wine_packages/${id}/cancel`, { method: "POST", auth: true })
    },
    accept(id) {
      return request<WinePackage>(`/wine_packages/${id}/accept`, { method: "POST", auth: true })
    },
    reject(id, reason) {
      return request<WinePackage>(`/wine_packages/${id}/reject`, { method: "POST", auth: true, body: reason === undefined ? {} : { rejection_reason: reason } })
    },
  }
}

export function createWinePackageItemsApi(request: ApiRequester): WinePackageItemsApi {
  return {
    create(packageId, payload: WinePackageItemWritePayload) {
      return request<WinePackageItem>(`/wine_packages/${packageId}/items`, { method: "POST", auth: true, body: { item: payload as unknown as Record<string, never> } })
    },
    update(packageId, itemId, payload: WinePackageItemWritePayload) {
      return request<WinePackageItem>(`/wine_packages/${packageId}/items/${itemId}`, { method: "PATCH", auth: true, body: { item: payload as unknown as Record<string, never> } })
    },
    destroy(packageId, itemId) {
      return request(`/wine_packages/${packageId}/items/${itemId}`, { method: "DELETE", auth: true })
    },
    createReview(packageId, itemId, payload) {
      return request<Review>(`/wine_packages/${packageId}/items/${itemId}/create_review`, { method: "POST", auth: true, body: { review: payload as unknown as Record<string, never> } })
    },
  }
}

export function createShipmentTrackingsApi(request: ApiRequester): ShipmentTrackingsApi {
  return {
    show(packageId) {
      return request<ShipmentTracking>(`/wine_packages/${packageId}/shipment_tracking`, { auth: true })
    },
    update(packageId, payload: ShipmentTrackingWritePayload) {
      return request<ShipmentTracking>(`/wine_packages/${packageId}/shipment_tracking`, { method: "PATCH", auth: true, body: { shipment_tracking: payload as unknown as Record<string, never> } })
    },
    refresh(packageId) {
      return request<ShipmentTracking>(`/wine_packages/${packageId}/shipment_tracking/refresh`, { method: "POST", auth: true })
    },
  }
}

export function createNotificationsApi(request: ApiRequester): NotificationsApi {
  return {
    list(params) {
      return request<ResourceResponse<Notification>>(queryPath("/notifications", params), { auth: true })
    },
    unreadCount() {
      return request<{ unread_count: number }>("/notifications/unread_count", { auth: true })
    },
    markRead(id) {
      return request<Notification>(`/notifications/${id}/mark_read`, { method: "PATCH", auth: true })
    },
    markAllRead() {
      return request<{ marked: number }>("/notifications/mark_all_read", { method: "PATCH", auth: true })
    },
  }
}
