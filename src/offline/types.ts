import type { Article } from "../types/article"
import type { CommentDTO, CommentableKind } from "../types/comment"
import type { Review } from "../types/review"
import type { WinePackage, WinePackageListItem } from "../types/winePackage"

export type OfflineContentKind = "review" | "article"

export interface CachedContentRow {
  key: string
  accountId: string
  kind: OfflineContentKind
  identifier: string
  data: Review | Article
  cachedAt: string
  updatedAt: string | null
  savedOffline: boolean
  visibility: "public" | "account"
}

export interface CachedCommentThreadRow {
  key: string
  accountId: string
  kind: CommentableKind
  identifier: string
  comments: CommentDTO[]
  cachedAt: string
}

export interface FinderCacheRow {
  key: string
  accountId: string
  query: string
  data: unknown
  cachedAt: string
}

export interface QuizSessionRow {
  key: string
  accountId: string
  sessionId: string
  version: string
  data: unknown
  completed: boolean
  updatedAt: string
}

export interface PackageCacheRow {
  key: string
  accountId: string
  kind: "list" | "detail"
  identifier: string
  data: WinePackage | WinePackageListItem[]
  cachedAt: string
}

export type OutboxEntityType = "comment" | "like" | "quiz_result" | "wine_package"
export type OutboxStatus = "pending" | "syncing" | "failed" | "conflict"

export interface OutboxOperation {
  id: string
  idempotencyKey: string
  accountId: string
  entityType: OutboxEntityType
  entityId?: string
  action: string
  payload: unknown
  expectedVersion?: string | number
  createdAt: string
  attempts: number
  status: OutboxStatus
  lastError?: string
  nextAttemptAt?: string
}