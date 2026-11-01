// Pure payload-verification helpers used by the API health checks.
// Kept dependency-free so they can be unit-tested and reused by the
// CI smoke-test script.
//
// Payloads arrive from `fetch` as unvalidated JSON, so every helper takes
// `unknown` and narrows defensively rather than assuming a shape.

const isRecord = (data: unknown): data is Record<string, unknown> =>
  typeof data === "object" && data !== null && !Array.isArray(data);

export const isNonEmptyArray = (data: unknown): data is unknown[] =>
  Array.isArray(data) && data.length > 0;

export const isValidArray = (data: unknown): data is unknown[] =>
  Array.isArray(data);

export const isHealthyDetailedPayload = (data: unknown): boolean =>
  isRecord(data) && data.status === "ok" && data.database === "ok";

export const isAuthMePayload = (data: unknown): boolean =>
  isRecord(data) &&
  isRecord(data.user) &&
  Boolean(data.user.id) &&
  Boolean(data.user.email);

export const isProducerPayload = (data: unknown): boolean =>
  isRecord(data) && Boolean(data.id) && Boolean(data.slug) && Boolean(data.name);

export const isSubscriptionListPayload = (data: unknown): boolean =>
  Array.isArray(data) &&
  data.every(
    (plan) =>
      isRecord(plan) &&
      Boolean(plan.id) &&
      Boolean(plan.name) &&
      Array.isArray(plan.features),
  );

// Validates the subscription FEATURE catalogue itself, not just the list:
//  - every feature has a numeric id and a non-empty name
//  - no duplicate features within a plan
//  - free plans ship without features, paid plans expose at least one
export const areSubscriptionFeaturesValid = (data: unknown): boolean => {
  if (!Array.isArray(data) || data.length === 0) return false;

  return data.every((plan) => {
    const features = plan?.features;
    if (!Array.isArray(features)) return false;

    const ids = new Set();
    for (const feature of features) {
      if (!Number.isInteger(feature?.id)) return false;
      if (typeof feature?.name !== "string" || feature.name.trim() === "") return false;
      if (ids.has(feature.id)) return false;
      ids.add(feature.id);
    }

    const isFree =
      (!plan?.monthly_price_cents || plan.monthly_price_cents === 0) &&
      (!plan?.yearly_price_cents || plan.yearly_price_cents === 0);

    return isFree ? features.length === 0 : features.length > 0;
  });
};

export const hasStatusOk = (data: unknown): boolean =>
  typeof data === "object" && data !== null && "status" in data && data.status === "ok";

// --- Email diagnostics (issue #167) -------------------------------------------
// The `POST /api/v1/health/email/test` success payload:
//   { status: "delivered", configured_transport, effective_transport,
//     recipients, message, delivered_at }
export const isEmailTestDelivered = (data: unknown): boolean => {
  if (!isRecord(data)) return false;
  if (data.status !== "delivered") return false;
  if (typeof data.configured_transport !== "string") return false;
  if (typeof data.effective_transport !== "string") return false;
  if (!Array.isArray(data.recipients)) return false;
  if (data.recipients.some((recipient) => typeof recipient !== "string")) return false;
  if (typeof data.message !== "string") return false;
  if (typeof data.delivered_at !== "string") return false;
  return true;
};

// --- Notifications ----------------------------------------------------------
// The send-test-notification diagnostic must prove the new notification is
// actually reflected in the bell: the payload has to carry a positive
// `unread_count` — the exact number the bell's badge displays (driven by
// GET /api/v1/notifications/unread_count, which counts delivered + unread).
export const isNotificationTestDelivered = (data: unknown): boolean => {
  if (!isRecord(data)) return false;
  if (data.status !== "delivered") return false;
  if (typeof data.notification_id !== "number") return false;
  if (typeof data.notification_type !== "string") return false;
  if (data.notification_type !== "health_test") return false;
  if (typeof data.message !== "string") return false;
  if (typeof data.delivered_at !== "string") return false;
  if (typeof data.unread_count !== "number") return false;
  if (!Number.isInteger(data.unread_count)) return false;
  if (data.unread_count < 1) return false;
  return true;
};

// --- Search index ----------------------------------------------------------
// Full-text search runs on the `searchable` tsvector columns. A NULL tsvector
// satisfies no match, so rows that were never indexed are invisible to every
// `?query=` while the endpoint itself answers 200 with an empty list — which is
// precisely how "search returns nothing" goes unnoticed. These helpers let the
// health page report the index itself, not just the request.
export interface SearchIndexVectorStatus {
  total: number;
  missing: number;
}

export interface SearchIndexPayload {
  status: string;
  reviews: SearchIndexVectorStatus;
  articles: SearchIndexVectorStatus;
}

const isVectorStatus = (
  data: unknown,
): data is SearchIndexVectorStatus =>
  isRecord(data) &&
  typeof data.total === "number" &&
  typeof data.missing === "number";

export const isSearchIndexPayload = (
  data: unknown,
): data is SearchIndexPayload =>
  isRecord(data) &&
  isVectorStatus(data.reviews) &&
  isVectorStatus(data.articles);

export const isSearchIndexHealthy = (data: unknown): boolean =>
  isSearchIndexPayload(data) &&
  data.reviews.missing === 0 &&
  data.articles.missing === 0;

export const describeSearchIndexFailure = (data: unknown): string => {
  if (!isSearchIndexPayload(data)) {
    return "Expected { reviews: { total, missing }, articles: { total, missing } }";
  }

  const unindexed: string[] = [];
  if (data.reviews.missing > 0) unindexed.push(`${data.reviews.missing} review(s)`);
  if (data.articles.missing > 0) unindexed.push(`${data.articles.missing} article(s)`);

  return `${unindexed.join(" and ")} are not indexed, so search cannot find them — run \`bin/rails search:reindex\``;
};
