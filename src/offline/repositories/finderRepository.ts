import { accountKey, withOfflineStorage } from "../db"

const MAX_FINDER_RESULTS = 20

export async function cacheFinderResult(
  accountId: string | number | null | undefined,
  query: string,
  data: unknown,
): Promise<boolean> {
  const scope = accountKey(accountId)
  return withOfflineStorage(async (db) => {
    const normalized = query.trim().toLowerCase() || "default"
    await db.finder.put({
      key: `${scope}:${normalized}`,
      accountId: scope,
      query: normalized,
      data,
      cachedAt: new Date().toISOString(),
    })
    const rows = await db.finder.where("accountId").equals(scope).sortBy("cachedAt")
    await db.finder.bulkDelete(rows.slice(0, Math.max(0, rows.length - MAX_FINDER_RESULTS)).map((row) => row.key))
    return true
  }, false)
}

export async function listRecentFinderResults(
  accountId: string | number | null | undefined,
  limit = 10,
) {
  const scope = accountKey(accountId)
  return withOfflineStorage(async (db) => {
    const rows = await db.finder.where("accountId").equals(scope).reverse().sortBy("cachedAt")
    return rows.slice(0, limit)
  }, [])
}