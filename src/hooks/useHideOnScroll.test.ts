import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { useHideOnScroll } from "./useHideOnScroll"

/** jsdom does not implement scrolling, so drive `scrollY` directly. */
function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", {
    value,
    writable: true,
    configurable: true,
  })
}

/** Dispatch a scroll event and let the rAF-throttled handler run. */
async function scrollTo(y: number) {
  setScrollY(y)
  window.dispatchEvent(new Event("scroll"))
  await act(async () => {
    await new Promise((resolve) => window.requestAnimationFrame(resolve))
  })
}

describe("useHideOnScroll", () => {
  // `scrollY` persists on the shared jsdom window between tests, and the hook
  // records the starting position on mount, so each test must start at the top.
  beforeEach(() => {
    setScrollY(0)
  })

  it("stays visible when disabled, even after scrolling down", async () => {
    const { result } = renderHook(() => useHideOnScroll(false))
    await scrollTo(600)
    expect(result.current).toBe(false)
  })

  it("hides after scrolling down past the threshold", async () => {
    const { result } = renderHook(() => useHideOnScroll(true))
    await scrollTo(400)
    expect(result.current).toBe(true)
  })

  it("reveals again when scrolling back up", async () => {
    const { result } = renderHook(() => useHideOnScroll(true))
    await scrollTo(400)
    expect(result.current).toBe(true)

    await scrollTo(200)
    expect(result.current).toBe(false)
  })

  it("stays visible near the top of the page", async () => {
    const { result } = renderHook(() => useHideOnScroll(true))
    await scrollTo(40)
    expect(result.current).toBe(false)
  })

  it("ignores sub-threshold jitter so the header does not flicker", async () => {
    const { result } = renderHook(() => useHideOnScroll(true))
    await scrollTo(300)
    expect(result.current).toBe(true)

    await scrollTo(303)
    expect(result.current).toBe(true)
  })
})
