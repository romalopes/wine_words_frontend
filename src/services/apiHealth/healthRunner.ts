import { API_BASE_URL } from "../api";
import { errorMessage } from "../../utils/errors";
import {
  DEFAULT_THRESHOLDS,
  type ApiCategory,
  type ApiCheck,
  type LatencyThresholds,
} from "./apiHealthConfig";

type LatencyRating = "excellent" | "good" | "slow" | "very_slow";
type HealthHeaders = Record<string, string>;

export interface HealthCheckOptions {
  // Widened with `| undefined` so callers can spread optional config straight
  // through without each one needing `?? undefined`.
  getAuthToken?: (() => string | null) | undefined;
  timeoutMs?: number | undefined;
  body?: BodyInit | undefined;
}

export interface HealthCheckResult {
  id: string;
  name: string;
  category: ApiCategory;
  passed: boolean;
  status: number | null;
  expectedStatus: number;
  latencyMs: number;
  latencyRating: LatencyRating;
  payload: unknown;
  requestHeaders: HealthHeaders;
  error: string | null;
  retried: boolean;
}

interface AttemptResult {
  response: Response;
  payload: unknown;
  headers: HealthHeaders;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    error instanceof TypeError
  );
}

function classifyError(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") return "Timeout";
  if (error instanceof TypeError) return "Network / CORS / DNS Unreachable";
  return errorMessage(error, String(error));
}

export function rateLatency(
  latencyMs: number,
  thresholds: LatencyThresholds = DEFAULT_THRESHOLDS,
): LatencyRating {
  if (latencyMs <= thresholds.excellent) return "excellent";
  if (latencyMs <= thresholds.good) return "good";
  if (latencyMs <= thresholds.slow) return "slow";
  return "very_slow";
}

function redactHeaders(headers: HealthHeaders): HealthHeaders {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      /authorization/i.test(key) ? "Bearer [REDACTED]" : value,
    ]),
  );
}

async function attemptRequest(
  check: ApiCheck,
  { getAuthToken, timeoutMs, body }: HealthCheckOptions,
): Promise<AttemptResult> {
  const timeout = check.timeoutMs || timeoutMs || 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const headers: HealthHeaders = { Accept: "application/json" };

  if (check.requiresAuth && getAuthToken) {
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  // A POST/SET body always carries an explicit content type; GET checks ship
  // without one.
  if (body) headers["Content-Type"] = "application/json";

  try {
    const response = await fetch(`${API_BASE_URL}${check.url}`, {
      method: check.method,
      headers,
      signal: controller.signal,
      ...(body ? { body } : {}),
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json().catch((): unknown => ({}))
      : await response.text();
    return { response, payload, headers };
  } finally {
    clearTimeout(timer);
  }
}

export async function runCheck(
  check: ApiCheck,
  { getAuthToken, timeoutMs, body }: HealthCheckOptions = {},
): Promise<HealthCheckResult> {
  const start = performance.now();
  let result: AttemptResult | null = null;
  let requestError: unknown = null;
  let retried = false;

  try {
    result = await attemptRequest(check, { getAuthToken, timeoutMs, body });
  } catch (error) {
    requestError = error;
    if (isRetryableError(error)) {
      await sleep(300);
      retried = true;
      try {
        result = await attemptRequest(check, { getAuthToken, timeoutMs, body });
        requestError = null;
      } catch (retryError) {
        requestError = retryError;
      }
    }
  }

  const latencyMs = Math.round(performance.now() - start);
  const status = result?.response.status ?? null;
  const payload = result?.payload ?? null;
  let passed = false;
  let validationError: string | null = null;

  if (result && status === check.expectedStatus) {
    try {
      passed = check.validate ? check.validate(payload) : true;
      if (!passed) {
        validationError =
          check.describeFailure?.(payload) || "Payload validation failed";
      }
    } catch (error) {
      validationError = `Validation threw: ${errorMessage(error, "Unknown validation error")}`;
    }
  } else if (result) {
    validationError = `Expected status ${check.expectedStatus}, got ${status}`;
  }

  return {
    id: check.id,
    name: check.name,
    category: check.category,
    passed,
    status,
    expectedStatus: check.expectedStatus,
    latencyMs,
    latencyRating: rateLatency(
      latencyMs,
      check.latencyThresholds || DEFAULT_THRESHOLDS,
    ),
    payload,
    requestHeaders: redactHeaders(result?.headers || {}),
    error: requestError ? classifyError(requestError) : validationError,
    retried,
  };
}

// Creates a temporary producer, then deletes it. This check is manual-only.
export async function runWriteFlow(
  check: ApiCheck,
  { getAuthToken, timeoutMs }: HealthCheckOptions = {},
): Promise<HealthCheckResult> {
  const start = performance.now();
  const timeout = check.timeoutMs || timeoutMs || 5000;
  const suffix = Date.now();
  const producerName = `Health Check Temp ${suffix}`;
  const createBody = JSON.stringify({
    producer: {
      name: producerName,
      email: `health-check-${suffix}@winewords.com`,
    },
  });
  const headers: HealthHeaders = {
    Accept: "application/json",
  };

  if (getAuthToken) {
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let createdId: unknown = null;
  let createStatus: number | null = null;
  let flowError: string | null = null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const createResponse = await fetch(`${API_BASE_URL}${check.url}`, {
      method: "POST",
      headers,
      body: createBody,
      signal: controller.signal,
    });
    createStatus = createResponse.status;
    const createPayload = await createResponse
      .json()
      .catch((): unknown => ({}));
    if (
      typeof createPayload === "object" &&
      createPayload !== null &&
      "id" in createPayload
    ) {
      createdId = createPayload.id;
    }

    if (createResponse.status === 201 && createdId) {
      const deleteResponse = await fetch(
        `${API_BASE_URL}${check.url}/${String(createdId)}`,
        {
          method: "DELETE",
          headers,
          signal: controller.signal,
        },
      );
      if (deleteResponse.status !== 204) {
        flowError = `Cleanup DELETE returned ${deleteResponse.status}`;
      }
    } else {
      flowError = `Create returned ${createResponse.status}`;
    }
  } catch (error) {
    flowError = classifyError(error);
  } finally {
    clearTimeout(timer);
  }

  const latencyMs = Math.round(performance.now() - start);
  return {
    id: check.id,
    name: check.name,
    category: check.category,
    passed: !flowError && createStatus === 201,
    status: createStatus,
    expectedStatus: 201,
    latencyMs,
    latencyRating: rateLatency(
      latencyMs,
      check.latencyThresholds || DEFAULT_THRESHOLDS,
    ),
    payload: { createdProducerId: createdId, tempName: producerName },
    requestHeaders: redactHeaders(headers),
    error: flowError,
    retried: false,
  };
}
