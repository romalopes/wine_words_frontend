import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { WineWordsOfflineDb, clearOfflineAccount, setOfflineDbForTests } from "./db"
import {
  cachePackageDetail,
  cachePackageList,
  getCachedPackageDetail,
  getCachedPackageList,
} from "./repositories/packageRepository"
import type { WinePackage, WinePackageListItem } from "../types/winePackage"

function listItem(id: number, producerName: string): WinePackageListItem {
  return {
    id,
    producer_id: 3,
    producer_name: producerName,
    producer_slug: producerName.toLowerCase(),
    reviewer_id: 1,
    reviewer_name: "Reviewer",
    status: "arrived",
    source: "unexpected",
    expected_at: null,
    arrived_at: "2026-09-01T09:00:00Z",
    review_deadline: null,
    items_count: 2,
    pending_review_count: 1,
    review_progress: { requested: 2, reviewed: 1, pending: 1, percent: 50 },
    auto_completed: false,
    tracking_status: null,
    overdue: false,
    days_until_deadline: null,
    created_at: "2026-09-01T09:00:00Z",
    updated_at: "2026-09-01T09:00:00Z",
  } as WinePackageListItem
}

function detail(id: number, producerName: string): WinePackage {
  return {
    ...listItem(id, producerName),
    created_by_id: 1,
    notes: null,
    reviewed_at: null,
    reviews_complete: false,
    can: { update: true, destroy: true, create_review: true },
    items: [],
  } as unknown as WinePackage
}

describe("package repository offline cache", () => {
  let db: WineWordsOfflineDb

  beforeEach(() => {
    db = new WineWordsOfflineDb(`wine-words-packages-${crypto.randomUUID()}`)
    setOfflineDbForTests(db)
  })

  afterEach(async () => {
    db.close()
    await db.delete()
    setOfflineDbForTests(null)
  })

  it("serves cached list and detail as a fallback when the API is unreachable", async () => {
    await cachePackageList(1, "page-1", [listItem(7, "Penfolds")])
    await cachePackageDetail(1, detail(7, "Penfolds"))

    const list = await getCachedPackageList(1, "page-1")
    expect(list).not.toBeNull()
    expect(list?.items).toHaveLength(1)
    expect(list?.items[0]?.producer_name).toBe("Penfolds")
    expect(list?.cachedAt).toBeTruthy()

    const cachedDetail = await getCachedPackageDetail(1, 7)
    expect(cachedDetail).not.toBeNull()
    expect(cachedDetail?.data.id).toBe(7)
    expect(cachedDetail?.data.producer_name).toBe("Penfolds")
    expect(cachedDetail?.cachedAt).toBeTruthy()
  })

  it("returns null for unknown identifiers instead of inventing rows", async () => {
    expect(await getCachedPackageList(1, "never-cached")).toBeNull()
    expect(await getCachedPackageDetail(1, 999)).toBeNull()
  })

  it("keeps package caches isolated between accounts", async () => {
    await cachePackageList(1, "shared-filter", [listItem(7, "Account One List")])
    await cachePackageList(2, "shared-filter", [listItem(7, "Account Two List")])
    await cachePackageDetail(1, detail(7, "Account One Detail"))
    await cachePackageDetail(2, detail(7, "Account Two Detail"))

    expect(
      (await getCachedPackageList(1, "shared-filter"))?.items[0]?.producer_name,
    ).toBe("Account One List")
    expect(
      (await getCachedPackageList(2, "shared-filter"))?.items[0]?.producer_name,
    ).toBe("Account Two List")
    expect((await getCachedPackageDetail(1, 7))?.data.producer_name).toBe(
      "Account One Detail",
    )
    expect((await getCachedPackageDetail(2, 7))?.data.producer_name).toBe(
      "Account Two Detail",
    )
  })

  it("purges every package row on logout without touching another account", async () => {
    await cachePackageList(1, "list-a", [listItem(1, "Leaving")])
    await cachePackageList(1, "list-b", [listItem(2, "Leaving Two")])
    await cachePackageDetail(1, detail(1, "Leaving Detail"))
    await cachePackageList(2, "list-a", [listItem(3, "Staying")])
    await cachePackageDetail(2, detail(3, "Staying Detail"))

    await clearOfflineAccount(1)

    expect(await db.packages.where("accountId").equals("1").count()).toBe(0)
    expect(await getCachedPackageList(1, "list-a")).toBeNull()
    expect(await getCachedPackageDetail(1, 1)).toBeNull()
    expect((await getCachedPackageList(2, "list-a"))?.items[0]?.producer_name).toBe("Staying")
    expect((await getCachedPackageDetail(2, 3))?.data.producer_name).toBe("Staying Detail")
  })

  it("overwrites an existing cache entry instead of duplicating it", async () => {
    await cachePackageList(1, "page-1", [listItem(7, "Before")])
    await cachePackageList(1, "page-1", [listItem(8, "After")])

    const list = await getCachedPackageList(1, "page-1")
    expect(list?.items).toHaveLength(1)
    expect(list?.items[0]?.producer_name).toBe("After")
    expect(await db.packages.where("accountId").equals("1").count()).toBe(1)
  })
})
