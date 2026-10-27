import { ApiError } from "./ApiError";
import { request as apiRequest } from "./apiClient";
import type { ApiRequester, RequestOptions } from "./apiClient";
import { createAuthApi, createIdentitiesApi } from "./authApi";
import { createAnalyticsApi } from "./analyticsApi";
import {
  createArticlesApi,
  createProducersApi,
  createReviewsApi,
  createSourcesApi,
  createWinesApi,
} from "./contentApi";
import {
  createNotificationsApi,
  createShipmentTrackingsApi,
  createWinePackageItemsApi,
  createWinePackagesApi,
} from "./packagesApi";
import {
  createAccountApi,
  createBillingApi,
  createInvitationsApi,
  createSubscriptionsApi,
  createUserApi,
  createUsersApi,
  createVintagesApi,
} from "./accountApi";
import { createImagesApi, createWineProfilesApi } from "./imagesApi";
import { createLikesApi } from "./likesApi";
import { createFollowsApi } from "./followsApi";
import { createCommentsApi } from "./commentsApi";
import { createArticleProjectsApi } from "./articleProjectsApi";
import {
  createCategoriesApi,
  createCountriesApi,
  createGrapesApi,
  createRegionsApi,
  createStatsApi,
  createTasteParametersApi,
} from "./referenceApi";
import {
  createConfigurationApi,
  createEmailVerificationsApi,
  createImpersonationApi,
  createLogsApi,
  createSettingsApi,
  createTestAccessApi,
} from "./adminApi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL; //|| "http://localhost:3000/api/v1").replace(/\/+$/, "");

const TOKEN_STORAGE_KEY = "wine_prediction_token";

// --- Private test-access gate ---------------------------------------------
// While the Rails API has TEST_ACCESS_PASSWORD configured, every request must
// carry a signed test-access token in the X-Test-Access-Token header. The
// token is exchanged for the password at /test_access (server-side check) and
// stored in sessionStorage — never the password itself, never localStorage.
export const TEST_ACCESS_STORAGE_KEY = "wine_words_test_access_token";

export function getTestAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(TEST_ACCESS_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Pass null (or omit) to clear the stored token. */
export function setTestAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      window.sessionStorage.setItem(TEST_ACCESS_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(TEST_ACCESS_STORAGE_KEY);
    }
  } catch {
    // Storage may be unavailable (private mode); access just won't persist
    // across refreshes.
  }
}

export function clearTestAccessToken() {
  setTestAccessToken(null);
}

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }
}

// Restore any previously stored token at module load.
if (typeof window !== "undefined") {
  authToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

// Raw bearer token for callers that manage their own fetch (e.g. the API-health
// runner). Read straight from storage — the single source of truth — rather
// than from React state, so a health check always uses the token that is
// actually persisted.
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return authToken;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

// Legacy namespace adapter. Transport and error construction live in the
// TypeScript client; this wrapper preserves the test-access header and redirect.
const request: ApiRequester = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  const testAccessToken = getTestAccessToken();
  const headers = {
    ...options.headers,
    ...(testAccessToken ? { "X-Test-Access-Token": testAccessToken } : {}),
  };

  try {
    return await apiRequest<T>(API_BASE_URL, path, getAuthToken, {
      ...options,
      headers,
    });
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      error.code === "test_access_required" &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/test-access")
    ) {
      clearTestAccessToken();
      window.location.assign("/test-access?expired=1");
    }
    throw error;
  }
};

export const authApi = createAuthApi(request);
export const identitiesApi = createIdentitiesApi(request);

export const analyticsApi = createAnalyticsApi(request);

export const imagesApi = createImagesApi(request);

export const winesApi = createWinesApi(request);

export const producersApi = createProducersApi(request);

export const sourcesApi = createSourcesApi(request);

export const wineProfilesApi = createWineProfilesApi(request);

export const userApi = createUserApi(request);
export const usersApi = createUsersApi(request);
export const invitationsApi = createInvitationsApi(request);
export const subscriptionsApi = createSubscriptionsApi(request);
export const accountApi = createAccountApi(request);
export const billingApi = createBillingApi(request);
export const vintagesApi = createVintagesApi(request);

export const tasteParametersApi = createTasteParametersApi(request);

export const reviewsApi = createReviewsApi(request);

export const articlesApi = createArticlesApi(request);

export const articleProjectsApi = createArticleProjectsApi(request);

export const likesApi = createLikesApi(request);

export const followsApi = createFollowsApi(request);

export const commentsApi = createCommentsApi(request);

export const categoriesApi = createCategoriesApi(request);

export const grapesApi = createGrapesApi(request);

export const countriesApi = createCountriesApi(request);

export const statsApi = createStatsApi(request);

export const regionsApi = createRegionsApi(request);

export const logsApi = createLogsApi(request);
export const impersonationApi = createImpersonationApi(request);
export const configurationApi = createConfigurationApi(request);
export const emailVerificationsApi = createEmailVerificationsApi(request);
export const settingsApi = createSettingsApi(request);
export const testAccessApi = createTestAccessApi(request);

// --- Wine packages: the reviewing workflow ---------------------------------
//
// A package is a producer shipment that a reviewer is responsible for. The
// backend exposes CRUD plus explicit workflow actions (never a free-form status
// write), so each action below maps to one route.
export const winePackagesApi = createWinePackagesApi(request);

// The wine lines inside a package. `review_requested` is what makes a line
// block the package from completing.
export const winePackageItemsApi = createWinePackageItemsApi(request);

// Tracking is a singleton per package: read it, upsert it, refresh it from the
// carrier provider the backend resolves from the carrier name.
export const shipmentTrackingsApi = createShipmentTrackingsApi(request);

// The signed-in user's own notifications (review-deadline reminders).
export const notificationsApi = createNotificationsApi(request);

export { API_BASE_URL };
