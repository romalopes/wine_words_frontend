import type { Article } from "../../types/article"
import type { CommentDTO, CommentableKind } from "../../types/comment"
import type { Review } from "../../types/review"
import { accountKey, withOfflineStorage } from "../db"
import type { CachedContentRow, OfflineContentKind } from "../types"

const MAX_OPENED_CONTENT_PER_ACCOUNT = 50

function contentKey(accountId: string, kind: OfflineContentKind, identifier: string | number) {
  return `${accountId}:${kind}:${identifier}`
}

function commentsKey(accountId: string, kind: CommentableKind, identifier: string | number) {
  return `${accountId}:${kind}:${identifier}`
}

export async function cacheContent(
  accountId: string | number | null | undefined,
  kind: OfflineContentKind,
  identifier: string | number,
  data: Review | Article,
  options: { savedOffline?: boolean; visibility?: "public" | "account" } = {},
): Promise<boolean> {
  const scope = accountKey(accountId)
  return withOfflineStorage(async (db) => {
    const key = contentKey(scope, kind, identifier)
    const existing = await db.content.get(key)
    const row: CachedContentRow = {
      key,
      accountId: scope,
      kind,
      identifier: String(identifier),
      data,
      cachedAt: new Date().toISOString(),
      updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
      savedOffline: options.savedOffline ?? existing?.savedOffline ?? false,
      visibility: options.visibility ?? existing?.visibility ?? "account",
    }
    await db.content.put(row)

    const opened = await db.content
      .where("accountId")
      .equals(scope)
      .filter((candidate) => !candidate.savedOffline)
      .sortBy("cachedAt")
    const excess = opened.slice(0, Math.max(0, opened.length - MAX_OPENED_CONTENT_PER_ACCOUNT))
    await db.content.bulkDelete(excess.map((candidate) => candidate.key))
    return true
  }, false)
}

export async function getCachedContent<T extends Review | Article>(
  accountId: string | number | null | undefined,
  kind: OfflineContentKind,
  identifier: string | number,
): Promise<CachedContentRow & { data: T } | null> {
  const scope = accountKey(accountId)
  return withOfflineStorage(async (db) => {
    const row = await db.content.get(contentKey(scope, kind, identifier))
    return (row as CachedContentRow & { data: T }) ?? null
  }, null)
}

export async function setContentSavedOffline(
  accountId: string | number | null | undefined,
  kind: OfflineContentKind,
  identifier: string | number,
  savedOffline: boolean,
): Promise<boolean> {
  const scope = accountKey(accountId)
  return withOfflineStorage(async (db) => {
    const updated = await db.content.update(contentKey(scope, kind, identifier), { savedOffline })
    return updated > 0
  }, false)
}

export async function cacheCommentThread(
  accountId: string | number | null | undefined,
  kind: CommentableKind,
  identifier: string | number,
  comments: CommentDTO[],
): Promise<boolean> {
  const scope = accountKey(accountId)
  return withOfflineStorage(async (db) => {
    await db.comments.put({
      key: commentsKey(scope, kind, identifier),
      accountId: scope,
      kind,
      identifier: String(identifier),
      comments,
      cachedAt: new Date().toISOString(),
    })
    return true
  }, false)
}

export async function getCachedCommentThread(
  accountId: string | number | null | undefined,
  kind: CommentableKind,
  identifier: string | number,
) {
  const scope = accountKey(accountId)
  return withOfflineStorage(
    (db) => db.comments.get(commentsKey(scope, kind, identifier)).then((row) => row ?? null),
    null,
  )
}