import { errorStatus } from "../utils/errors"

/** Never use cached data to bypass authentication, authorization, or a real 404. */
export function mayUseOfflineFallback(error: unknown): boolean {
  const status = errorStatus(error)
  return status === null || status >= 500
}