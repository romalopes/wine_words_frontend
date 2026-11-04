import { useEffect, useState } from "react"

/**
 * Subscribe to a CSS media query.
 *
 * Returns `false` during SSR and when `window.matchMedia` is unavailable (jsdom
 * without a stub), so callers default to the desktop presentation rather than
 * crashing.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false
    }
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }

    const mediaQueryList = window.matchMedia(query)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)

    // Sync immediately in case the query changed between render and effect.
    setMatches(mediaQueryList.matches)
    mediaQueryList.addEventListener("change", onChange)
    return () => mediaQueryList.removeEventListener("change", onChange)
  }, [query])

  return matches
}
