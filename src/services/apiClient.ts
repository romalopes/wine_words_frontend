import { ApiError } from "./ApiError"
import type { QueryParams, QueryValue } from "../types/common"

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
export type RequestBody = JsonValue | FormData

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  body?: RequestBody
  auth?: boolean
  headers?: Record<string, string>
  /**
   * Cancels the request when the caller's `AbortController` aborts. Used by
   * `useSearch`, where a keystroke supersedes the request that is still in
   * flight: without it, every intermediate query would finish server-side and
   * merely be discarded on arrival.
   */
  signal?: AbortSignal
}

export type AuthTokenProvider = () => string | null

/**
 * The transport contract every API namespace factory depends on.
 *
 * Declared once here rather than in each namespace module: the factories in
 * `authApi` / `contentApi` / `packagesApi` / ... all take the same generic
 * requester, and a single definition keeps them structurally assignable. Each
 * namespace re-exports it so existing `import type { ApiRequester }` sites
 * keep working.
 */
export interface ApiRequester {
  <T>(path: string, options?: RequestOptions): Promise<T>
}

export function buildQuery(params: QueryParams): string {
  const search = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    appendQueryValue(search, key, value)
  })

  const query = search.toString()
  return query ? `?${query}` : ""
}

function appendQueryValue(
  search: URLSearchParams,
  key: string,
  value: QueryValue | QueryValue[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item) => appendQueryValue(search, key, item))
    return
  }

  if (value === undefined || value === null || value === "") return
  search.set(key, String(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function errorMessageFromPayload(data: unknown, status: number): string {
  if (isRecord(data)) {
    if (typeof data.error === "string" && data.error) return data.error
    if (typeof data.message === "string" && data.message) return data.message
    if (Array.isArray(data.errors)) {
      const messages = data.errors.filter(
        (item): item is string => typeof item === "string",
      )
      if (messages.length > 0) return messages.join(", ")
    }
  }

  if (typeof data === "string" && data) return data
  return `Request failed with status ${status}`
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) {
    if (contentType.includes("application/pdf") || contentType.includes("application/octet-stream")) {
      return response.blob()
    }
    return response.text()
  }

  try {
    return await response.json()
  } catch {
    return {}
  }
}

export async function request<T>(
  apiBaseUrl: string,
  path: string,
  getAuthToken: AuthTokenProvider,
  {
    method = "GET",
    body,
    auth = false,
    headers = {},
    signal,
  }: RequestOptions = {},
): Promise<T> {
  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  }

  let payload: BodyInit | undefined
  if (body instanceof FormData) {
    payload = body
  } else if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json"
    payload = JSON.stringify(body)
  }

  const token = auth ? getAuthToken() : null
  if (token) requestHeaders.Authorization = `Bearer ${token}`

  // Spread rather than `body: payload`: under exactOptionalPropertyTypes a
  // present-but-undefined `body` is not assignable to RequestInit["body"].
  // `signal` follows the same rule.
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: requestHeaders,
    ...(payload === undefined ? {} : { body: payload }),
    ...(signal === undefined ? {} : { signal }),
    credentials: "include",
  })

  const data = await parseResponseBody(response)

  if (!response.ok) {
    const code = isRecord(data) && typeof data.code === "string" ? data.code : undefined
    throw new ApiError(
      errorMessageFromPayload(data, response.status),
      response.status,
      data,
      code,
    )
  }

  const authorizationHeader = response.headers.get("Authorization")
  if (authorizationHeader && isRecord(data)) {
    return {
      ...data,
      token: authorizationHeader.replace(/^Bearer\s+/i, ""),
    } as T
  }

  return data as T
}
