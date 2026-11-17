// Shared vocabulary for the wine-package screens, mirroring the backend's
// string-backed enums (WinePackage::STATUSES / SOURCES). Keeping the labels and
// badge tones in one place means the list, the detail page and the form can
// never drift apart.

export const PACKAGE_STATUSES = [
  "draft", "requested", "accepted", "rejected", "announced", "in_transit", "arrived", "reviewing", "completed", "cancelled",
  "editorial_pending", "assessment_in_progress", "partially_approved", "approved",
] as const

export const PACKAGE_SOURCES = ["manual", "unexpected", "producer_request", "producer_announcement"] as const

export type PackageStatus = (typeof PACKAGE_STATUSES)[number]
export type PackageSource = (typeof PACKAGE_SOURCES)[number]
export type BadgeTone = "neutral" | "info" | "warn" | "ok" | "bad"

export interface ItemReviewState {
  label: string
  tone: BadgeTone
}

export interface ReviewablePackageItem {
  review_requested?: boolean | null
  reviewed?: boolean | null
  review_id?: number | null
  review_status?: string | null
}

const STATUS_LABELS: Readonly<Record<PackageStatus, string>> = {
  draft: "Draft",
  requested: "Requested",
  accepted: "Accepted",
  rejected: "Rejected",
  announced: "Announced",
  in_transit: "In transit",
  arrived: "Arrived",
  reviewing: "Reviewing",
  completed: "Completed",
  cancelled: "Cancelled",
  editorial_pending: "Editorial pending",
  assessment_in_progress: "Assessment in progress",
  partially_approved: "Partially approved",
  approved: "Approved",
};

const SOURCE_LABELS: Readonly<Record<PackageSource, string>> = {
  manual: "Manual",
  unexpected: "Unexpected delivery",
  producer_request: "Producer request",
  producer_announcement: "Producer announcement",
};

// Badge tone: neutral / info / warn / ok / bad.
const STATUS_TONES: Readonly<Record<PackageStatus, BadgeTone>> = {
  draft: "neutral",
  requested: "info",
  accepted: "info",
  rejected: "bad",
  announced: "info",
  in_transit: "info",
  arrived: "warn",
  reviewing: "warn",
  completed: "ok",
  cancelled: "neutral",
  editorial_pending: "warn",
  assessment_in_progress: "info",
  partially_approved: "warn",
  approved: "ok",
};

export function statusLabel(status: PackageStatus | string | null | undefined): string {
  return (status && STATUS_LABELS[status as PackageStatus]) || status || "Unknown"
}

export function sourceLabel(source: PackageSource | string | null | undefined): string {
  return (source && SOURCE_LABELS[source as PackageSource]) || source || "Unknown"
}

export function statusTone(status: PackageStatus | string | null | undefined): BadgeTone {
  return (status && STATUS_TONES[status as PackageStatus]) || "neutral"
}

// Presentation for the shared `.wine-badge` pill in index.css. Kept beside the
// tones for the same reason the labels live here: one place to change.
const BADGE_TONE_CLASSES: Readonly<Record<BadgeTone, string>> = {
  neutral: "wine-badge--neutral",
  info: "wine-badge--info",
  warn: "wine-badge--warn",
  ok: "wine-badge--ok",
  bad: "wine-badge--bad",
};

export function badgeClass(tone: BadgeTone | string | null | undefined): string {
  const toneClass = tone ? BADGE_TONE_CLASSES[tone as BadgeTone] : undefined
  return `wine-badge ${toneClass || BADGE_TONE_CLASSES.neutral}`
}

// The review state of one line in a package. A line is reviewed as a VINTAGE of
// a wine, so it reads: not requested → pending → draft in progress → reviewed.
export const ITEM_REVIEW_STATES = {
  notRequested: { label: "Not requested", tone: "neutral" },
  pending: { label: "Pending", tone: "warn" },
  draft: { label: "Draft in progress", tone: "info" },
  reviewed: { label: "Reviewed", tone: "ok" },
} as const satisfies Readonly<Record<string, ItemReviewState>>

export function itemReviewState(item: ReviewablePackageItem | null | undefined): ItemReviewState {
  if (!item?.review_requested) return ITEM_REVIEW_STATES.notRequested
  if (item.reviewed) return ITEM_REVIEW_STATES.reviewed
  if (item.review_id && item.review_status === "draft") return ITEM_REVIEW_STATES.draft
  return ITEM_REVIEW_STATES.pending
}


