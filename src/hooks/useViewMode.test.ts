import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { useViewMode } from "./useViewMode"

const KEY = "wine-words:view-mode:test"

describe("useViewMode", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("falls back to the caller's default when nothing is stored", () => {
    const { result } = renderHook(() => useViewMode(KEY, "list"))

    expect(result.current[0]).toBe("list")
  })

  it("defaults to cards when no fallback is supplied", () => {
    const { result } = renderHook(() => useViewMode(KEY))

    expect(result.current[0]).toBe("cards")
  })

  it("persists the chosen mode and rehydrates it on the next mount", () => {
    const first = renderHook(() => useViewMode(KEY, "cards"))

    act(() => first.result.current[1]("list"))

    expect(first.result.current[0]).toBe("list")
    expect(localStorage.getItem(KEY)).toBe("list")

    // A fresh mount (the user navigated away and back) reads the stored value.
    const second = renderHook(() => useViewMode(KEY, "cards"))
    expect(second.result.current[0]).toBe("list")
  })

  it("ignores a stored value that is not a known mode", () => {
    localStorage.setItem(KEY, "grid")

    const { result } = renderHook(() => useViewMode(KEY, "list"))

    expect(result.current[0]).toBe("list")
  })

  it("keeps working when storage throws (private mode)", () => {
    const original = window.localStorage.getItem
    const getSpy = vi
      .spyOn(window.localStorage, "getItem")
      .mockImplementation(() => {
        throw new Error("storage disabled")
      })
    const setSpy = vi
      .spyOn(window.localStorage, "setItem")
      .mockImplementation(() => {
        throw new Error("storage disabled")
      })

    const { result } = renderHook(() => useViewMode(KEY, "cards"))
    expect(result.current[0]).toBe("cards")

    // Applying a mode must not throw when the write is refused.
    expect(() => act(() => result.current[1]("list"))).not.toThrow()
    expect(result.current[0]).toBe("list")

    getSpy.mockRestore()
    setSpy.mockRestore()
    expect(original).toBeDefined()
  })
})
