import type { WinePackage, WinePackageListItem } from "../../types/winePackage"
import { accountKey, withOfflineStorage } from "../db"

function packageKey(accountId: string | number, kind: "list" | "detail", identifier: string) {
  return `${accountKey(accountId)}:${kind}:${identifier}`
}

export async function cachePackageList(accountId: string | number, identifier: string, data: WinePackageListItem[]) {
  return withOfflineStorage(async (db) => {
    const cachedAt = new Date().toISOString()
    await db.packages.put({ key: packageKey(accountId, "list", identifier), accountId: accountKey(accountId), kind: "list", identifier, data, cachedAt })
    return cachedAt
  }, null)
}

export async function getCachedPackageList(accountId: string | number, identifier: string) {
  return withOfflineStorage(async (db) => {
    const row = await db.packages.get(packageKey(accountId, "list", identifier))
    return row ? { items: row.data as WinePackageListItem[], cachedAt: row.cachedAt } : null
  }, null)
}

export async function cachePackageDetail(accountId: string | number, data: WinePackage) {
  return withOfflineStorage(async (db) => {
    const cachedAt = new Date().toISOString()
    await db.packages.put({ key: packageKey(accountId, "detail", String(data.id)), accountId: accountKey(accountId), kind: "detail", identifier: String(data.id), data, cachedAt })
    return cachedAt
  }, null)
}

export async function getCachedPackageDetail(accountId: string | number, id: string | number) {
  return withOfflineStorage(async (db) => {
    const row = await db.packages.get(packageKey(accountId, "detail", String(id)))
    return row ? { data: row.data as WinePackage, cachedAt: row.cachedAt } : null
  }, null)
}