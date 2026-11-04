import { ApiError } from "../services/ApiError"
import { mayUseOfflineFallback } from "./fallback"

describe("mayUseOfflineFallback", () => {
  it("allows transport and server failures", () => {
    expect(mayUseOfflineFallback(new TypeError("Failed to fetch"))).toBe(true)
    expect(mayUseOfflineFallback(new ApiError("server", 503, {}))).toBe(true)
  })

  it("never bypasses authentication, authorization, or not-found responses", () => {
    expect(mayUseOfflineFallback(new ApiError("unauthorized", 401, {}))).toBe(false)
    expect(mayUseOfflineFallback(new ApiError("forbidden", 403, {}))).toBe(false)
    expect(mayUseOfflineFallback(new ApiError("missing", 404, {}))).toBe(false)
  })
})