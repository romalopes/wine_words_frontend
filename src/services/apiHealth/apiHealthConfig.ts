import { APP_VERSION } from "../../constants/versions";
import {
  isValidArray,
  isHealthyDetailedPayload,
  isAuthMePayload,
  isProducerPayload,
  isSubscriptionListPayload,
  areSubscriptionFeaturesValid,
  hasStatusOk,
  isSearchIndexHealthy,
  describeSearchIndexFailure,
  isEmailTestDelivered,
  isNotificationTestDelivered,
} from "./apiHealthValidators";

export const API_CATEGORIES = {
  SYSTEM: "System",
  AUTH: "Authentication",
  SECURITY: "Security Guards",
  REFERENCE: "Reference Data",
  PRODUCERS: "Producers",
  WINES: "Wines",
  REVIEWS: "Reviews",
  ARTICLES: "Articles",
  SUBSCRIPTIONS: "Subscriptions",
  WRITE_SANDBOX: "Write Operations (Manual)",
  EMAIL: "Email Diagnostics",
  NOTIFICATIONS: "Notifications",
};

export type ApiCategory = (typeof API_CATEGORIES)[keyof typeof API_CATEGORIES];
export interface LatencyThresholds {
  excellent: number;
  good: number;
  slow: number;
}

export type ApiValidator = (data: unknown) => boolean;

export interface ApiCheck {
  id: string;
  category: ApiCategory;
  name: string;
  method: string;
  url: string;
  expectedStatus: number;
  requiresAuth: boolean;
  validate?: ApiValidator;
  describeFailure?: (data: unknown) => string | undefined;
  latencyThresholds?: LatencyThresholds;
  timeoutMs?: number;
  requiresManualTrigger?: boolean;
  description?: string;
}

type ListCheckInput = Omit<
  ApiCheck,
  "method" | "expectedStatus" | "requiresAuth"
> &
  Partial<Pick<ApiCheck, "method" | "expectedStatus" | "requiresAuth">>;

export const DEFAULT_THRESHOLDS: LatencyThresholds = {
  excellent: 200,
  good: 500,
  slow: 1000,
};

// Factory for the repetitive public list-style checks. Fills in the common
// defaults (GET, expect 200, no auth, plain array validation) and lets each
// check override anything else (e.g. latency thresholds or a custom validator).
const listCheck = ({
  id,
  category,
  name,
  url,
  validate = isValidArray,
  ...overrides
}: ListCheckInput): ApiCheck => ({
  id,
  category,
  name,
  method: "GET",
  url,
  expectedStatus: 200,
  requiresAuth: false,
  validate,
  ...overrides,
});

export const API_CHECKS: ApiCheck[] = [
  {
    id: "system-liveness",
    category: API_CATEGORIES.SYSTEM,
    name: "Public Liveness Check",
    method: "GET",
    url: "/health",
    expectedStatus: 200,
    requiresAuth: false,
    validate: hasStatusOk,
  },
  {
    id: "system-detailed",
    category: API_CATEGORIES.SYSTEM,
    name: "Detailed Infrastructure Health",
    method: "GET",
    url: "/health/detailed",
    expectedStatus: 200,
    requiresAuth: true,
    validate: isHealthyDetailedPayload,
  },
  {
    id: "system-version-match",
    category: API_CATEGORIES.SYSTEM,
    name: "Backend Version Matches Frontend Constant",
    method: "GET",
    url: "/health/detailed",
    expectedStatus: 200,
    requiresAuth: true,
    // Compare the version reported by the Rails API (health response) against
    // the APP_VERSION constant expected by the frontend.
    validate: (data) => {
      if (typeof data !== "object" || data === null || !("version" in data)) {
        return false;
      }
      return data.version === APP_VERSION;
    },
    describeFailure: (data) => {
      const backendVersion =
        typeof data === "object" && data !== null && "version" in data
          ? String(data.version ?? "unknown")
          : "unknown";
      return `Backend version "${backendVersion}" does not match frontend APP_VERSION "${APP_VERSION}"`;
    },
  },
  {
    id: "search-index",
    category: API_CATEGORIES.SYSTEM,
    name: "Search Index Built (tsvector)",
    method: "GET",
    url: "/health/search_index",
    expectedStatus: 200,
    requiresAuth: true,
    // Fails on `status: "degraded"`, i.e. any row whose vector was never built.
    validate: isSearchIndexHealthy,
    describeFailure: describeSearchIndexFailure,
    latencyThresholds: { excellent: 150, good: 400, slow: 900 },
    description:
      "Full-text search only finds rows whose `searchable` vector exists; unindexed rows are invisible to every query.",
  },

  {
    id: "auth-me-valid",
    category: API_CATEGORIES.AUTH,
    name: "Authenticated Session Context",
    method: "GET",
    url: "/me",
    expectedStatus: 200,
    requiresAuth: true,
    validate: isAuthMePayload,
  },
  {
    id: "auth-me-rejected",
    category: API_CATEGORIES.SECURITY,
    name: "Unauthenticated Request Rejection",
    method: "GET",
    url: "/me",
    expectedStatus: 401,
    requiresAuth: false, // Intentionally exclude the auth header.
    validate: () => true,
  },
  listCheck({
    id: "ref-countries",
    category: API_CATEGORIES.REFERENCE,
    name: "Countries List",
    url: "/countries",
  }),
  listCheck({
    id: "ref-regions",
    category: API_CATEGORIES.REFERENCE,
    name: "Regions List",
    url: "/regions",
  }),
  listCheck({
    id: "ref-grapes",
    category: API_CATEGORIES.REFERENCE,
    name: "Grapes List",
    url: "/grapes",
  }),
  listCheck({
    id: "producers-list",
    category: API_CATEGORIES.PRODUCERS,
    name: "List Producers",
    url: "/producers",
    latencyThresholds: { excellent: 300, good: 700, slow: 1500 },
  }),
  listCheck({
    id: "wines-list",
    category: API_CATEGORIES.WINES,
    name: "List Wines",
    url: "/wines",
    latencyThresholds: { excellent: 300, good: 700, slow: 1500 },
  }),
  listCheck({
    id: "wines-grouped",
    category: API_CATEGORIES.WINES,
    name: "Grouped Wines (12 per category)",
    url: "/wines/grouped",
    latencyThresholds: { excellent: 300, good: 700, slow: 1500 },
    validate: (data: unknown) =>
      isValidArray(data) &&
      data.every(
        (g: unknown) =>
          typeof g === "object" && g !== null &&
          "category" in g && typeof g.category === "string" &&
          "count" in g && typeof g.count === "number" &&
          "wines" in g && isValidArray(g.wines),
      ),
    describeFailure: () =>
      "Expected an array of { category, count, wines } objects",
  }),
  listCheck({
    id: "reviews-grouped",
    category: API_CATEGORIES.REVIEWS,
    name: "Grouped Reviews (12 per category)",
    url: "/reviews/grouped",
    latencyThresholds: { excellent: 300, good: 700, slow: 1500 },
    validate: (data: unknown) =>
      isValidArray(data) &&
      data.every(
        (g: unknown) =>
          typeof g === "object" && g !== null &&
          "category" in g && typeof g.category === "string" &&
          "count" in g && typeof g.count === "number" &&
          "reviews" in g && isValidArray(g.reviews),
      ),
    describeFailure: () =>
      "Expected an array of { category, count, reviews } objects",
  }),
  listCheck({
    id: "articles-grouped",
    category: API_CATEGORIES.ARTICLES,
    name: "Grouped Articles (12 per category)",
    url: "/articles/grouped",
    latencyThresholds: { excellent: 300, good: 700, slow: 1500 },
    validate: (data: unknown) =>
      isValidArray(data) &&
      data.every(
        (g: unknown) =>
          typeof g === "object" && g !== null &&
          "category" in g && typeof g.category === "string" &&
          "count" in g && typeof g.count === "number" &&
          "articles" in g && isValidArray(g.articles),
      ),
    describeFailure: () =>
      "Expected an array of { category, count, articles } objects",
  }),
  // Free and paid plans are just rows of the same public list, so a single
  // check validates both the payload shape and that features are exposed.
  listCheck({
    id: "subscriptions-list",
    category: API_CATEGORIES.SUBSCRIPTIONS,
    name: "List Subscriptions (Public Plans)",
    url: "/subscriptions",
    validate: (data) =>
      Array.isArray(data) &&
      isSubscriptionListPayload(data) &&
      data.some(
        (plan) =>
          typeof plan === "object" &&
          plan !== null &&
          "features" in plan &&
          Array.isArray(plan.features) &&
          plan.features.length > 0,
      ),
    describeFailure: () =>
      "No subscription plan returned a non-empty feature list",
  }),
  listCheck({
    id: "subscriptions-features",
    category: API_CATEGORIES.SUBSCRIPTIONS,
    name: "Subscription Feature Catalogue Integrity",
    method: "GET",
    url: "/subscriptions",
    validate: areSubscriptionFeaturesValid,
    describeFailure: () =>
      "Subscription features failed validation: every feature needs a numeric id and a non-empty name, plans must not duplicate features, free plans must have no features and paid plans must have at least one",
  }),
  // --- Write sandbox (manual trigger only, excluded from "Run All") ---
  {
    id: "write-producer-create-delete",
    category: API_CATEGORIES.WRITE_SANDBOX,
    name: "Create + Delete a Temporary Producer",
    method: "POST",
    url: "/producers",
    expectedStatus: 201,
    requiresAuth: true,
    requiresManualTrigger: true,
    description:
      "Creates a temporary producer (name suffixed with a timestamp) then deletes it. Self-cleaning.",
    validate: isProducerPayload,
  },
  // --- Email diagnostics (issue #167) ----------------------------------------
  {
    id: "email-transport",
    category: API_CATEGORIES.EMAIL,
    name: "E-mail Transport",
    method: "GET",
    url: "/health/email/transport",
    expectedStatus: 200,
    requiresAuth: false,
    description: "Reports the configured and effective MAIL_TRANSPORT values.",
    latencyThresholds: { excellent: 100, good: 300, slow: 800 },
  },
  {
    id: "email-send-test",
    category: API_CATEGORIES.EMAIL,
    name: "Send Test E-mail",
    method: "POST",
    url: "/health/email/test",
    expectedStatus: 200,
    requiresAuth: true,
    requiresManualTrigger: true,
    description:
      "Delivers a single test e-mail to the To address you supply (no create/delete\npair, no persisted state). Returns the configured and effective transports on success.",
    validate: isEmailTestDelivered,
    latencyThresholds: { excellent: 200, good: 500, slow: 1000 },
  },
  // --- Notification diagnostics ----------------------------------------------
  {
    id: "notifications-send-test",
    category: API_CATEGORIES.NOTIFICATIONS,
    name: "Send Test Notification",
    method: "POST",
    url: "/health/notifications/test",
    expectedStatus: 200,
    requiresAuth: true,
    requiresManualTrigger: true,
    description:
      "Delivers a real in-app test notification to the signed-in admin and reports the\nunread count the notification bell will display — so the bell lighting up can be\nverified end to end. Re-runs re-use today's test row (idempotent, no feed flooding).",
    validate: isNotificationTestDelivered,
    latencyThresholds: { excellent: 200, good: 500, slow: 1000 },
  },
];

// A tiny helper to keep the config self-documenting.
export const isWriteCheck = (check: ApiCheck): boolean =>
  check.requiresManualTrigger === true ||
  check.category === API_CATEGORIES.WRITE_SANDBOX;

export const getCheckById = (id: string): ApiCheck | undefined =>
  API_CHECKS.find((check) => check.id === id);
