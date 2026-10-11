/** Opt-out mutation hook for analytics tracking. */

import { useCallback, useState } from "react";
import { accountApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { clearVisitorId } from "../utils/analyticsIdentity";

/**
 * Toggles `analytics_opt_out` server-side and clears the local visitor ID
 * immediately when opting out, so no further beacons link to past history.
 */
export function useAnalyticsOptOut() {
  const { user, refreshSession } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optedOut = Boolean(user?.analytics_opt_out);

  const setOptOut = useCallback(
    async (optOut: boolean) => {
      setSaving(true);
      setError(null);
      try {
        await accountApi.updateAnalyticsOptOut(optOut);
        if (optOut) clearVisitorId();
        await refreshSession();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update analytics preference");
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [refreshSession]
  );

  return { optedOut, setOptOut, saving, error };
}
