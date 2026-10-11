/** Consent hook for analytics tracking. */

import { useAuth } from "../contexts/AuthContext";

/**
 * Returns true if analytics tracking is permitted for the current user.
 * - Authenticated users: respects the `analytics_opt_out` flag (Phase 1 contract)
 * - Anonymous users: implied consent (Phase 11 will add banner)
 */
export function useAnalyticsConsent(): boolean {
  const { user } = useAuth();
  if (user) return !user.analytics_opt_out;
  return true;
}