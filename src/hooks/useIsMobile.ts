import { useMediaQuery } from "./useMediaQuery"
import { MOBILE_BREAKPOINT_PX } from "../constants/featureFlags"

/**
 * True when the viewport is at or below the mobile breakpoint.
 *
 * Uses CSS media queries (not OS/user-agent detection), matching the plan's
 * rule that native platform detection is reserved for native APIs only.
 */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`)
}
