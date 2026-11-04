import Dexie, { type EntityTable } from "dexie"
import type {
  CachedCommentThreadRow,
  CachedContentRow,
  FinderCacheRow,
  OutboxOperation,
  PackageCacheRow,
  QuizSessionRow,
} from "./types"

export const OFFLINE_DB_NAME = "wine-words-offline"

export class WineWordsOfflineDb extends Dexie {
  content!: EntityTable<CachedContentRow, "key">
  comments!: EntityTable<CachedCommentThreadRow, "key">
  finder!: EntityTable<FinderCacheRow, "key">
  quizSessions!: EntityTable<QuizSessionRow, "key">
  outbox!: EntityTable<OutboxOperation, "id">
  packages!: EntityTable<PackageCacheRow, "key">

  constructor(name = OFFLINE_DB_NAME) {
    super(name)
    this.version(1).stores({
      content: "key, accountId, [accountId+kind], [accountId+savedOffline], cachedAt",
      comments: "key, accountId, [accountId+kind], cachedAt",
      finder: "key, accountId, [accountId+cachedAt], cachedAt",
      quizSessions: "key, accountId, [accountId+updatedAt], completed, updatedAt",
      outbox: "id, accountId, [accountId+status], entityType, createdAt",
    })
    this.version(2).stores({
      content: "key, accountId, [accountId+kind], [accountId+savedOffline], cachedAt",
      comments: "key, accountId, [accountId+kind], cachedAt",
      finder: "key, accountId, [accountId+cachedAt], cachedAt",
      quizSessions: "key, accountId, [accountId+updatedAt], completed, updatedAt",
      outbox: "id, accountId, [accountId+status], entityType, createdAt",
      packages: "key, accountId, [accountId+kind], cachedAt",
    })
  }
}

let database: WineWordsOfflineDb | null = null

export function getOfflineDb(): WineWordsOfflineDb {
  database ??= new WineWordsOfflineDb()
  return database
}

export function setOfflineDbForTests(db: WineWordsOfflineDb | null): void {
  database = db
}

export function accountKey(accountId: string | number | null | undefined): string {
  return accountId === null || accountId === undefined ? "anonymous" : String(accountId)
}

export async function withOfflineStorage<T>(
  operation: (db: WineWordsOfflineDb) => Promise<T>,
  fallback: T,
): Promise<T> {
  if (typeof indexedDB === "undefined") return fallback
  try {
    return await operation(getOfflineDb())
  } catch (error) {
    console.warn("Offline storage is unavailable; continuing online-only.", error)
    return fallback
  }
}

export async function clearOfflineAccount(accountId: string | number): Promise<void> {
  const scope = accountKey(accountId)
  await withOfflineStorage(async (db) => {
    await db.transaction("rw", [db.content, db.comments, db.finder, db.quizSessions, db.outbox, db.packages], async () => {
      await Promise.all([
        db.content.where("accountId").equals(scope).delete(),
        db.comments.where("accountId").equals(scope).delete(),
        db.finder.where("accountId").equals(scope).delete(),
        db.quizSessions.where("accountId").equals(scope).delete(),
        db.outbox.where("accountId").equals(scope).delete(),
        db.packages.where("accountId").equals(scope).delete(),
      ])
    })
  }, undefined)
}