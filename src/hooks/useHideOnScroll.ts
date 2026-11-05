import { useEffect, useRef, useState } from "react"

/** Ignore scroll deltas below this (momentum and rubber-band jitter). */
const DELTA_PX = 6

/**
 * True while the user scrolls down past `threshold`; false when scrolling up or
 * while near the top of the page.
 *
 * Used to slide the mobile header out of the way so it stops eating vertical
 * space on a phone. Returns `false` whenever `enabled` is false — desktop, the
 * flag-off build, and while the nav panel is open — so the header stays put in
 * those cases. SSR-safe.
 *
 * Only the boolean is animated here; the movement itself is CSS, so
 * `prefers-reduced-motion` is honoured in one place.
 */
export function useHideOnScroll(enabled: boolean, threshold = 80): boolean {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setHidden(false)
      return
    }

    lastY.current = window.scrollY

    const update = () => {
      frame.current = null
      const y = window.scrollY
      const delta = y - lastY.current

      if (y <= threshold || delta < -DELTA_PX) {
        setHidden(false)
      } else if (delta > DELTA_PX) {
        setHidden(true)
      }

      lastY.current = y
    }

    // Coalesce bursts of scroll events into one measurement per frame.
    const onScroll = () => {
      if (frame.current !== null) return
      frame.current = window.requestAnimationFrame(update)
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      if (frame.current !== null) {
        window.cancelAnimationFrame(frame.current)
        frame.current = null
      }
    }
  }, [enabled, threshold])

  return hidden
}
