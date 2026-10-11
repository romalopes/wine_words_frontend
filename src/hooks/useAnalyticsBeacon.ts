/** Analytics beacon hook for tracking content views. */

import { useCallback, useRef } from "react";
import { getVisitorId, clearVisitorId } from "../utils/analyticsIdentity";
import { getNavigationContext } from "../utils/analyticsNavigation";
import { analyticsApi } from "../services/api";
import { useAnalyticsConsent } from "./useAnalyticsConsent";

interface BeaconPayload {
  event_type: "view";
  content_type: "Article" | "Review" | "Wine";
  content_id: number;
  occurred_at: string;
  source?: "direct" | "search" | "internal" | "external";
  referrer?: string | undefined;
  viewport?: string;
}

const DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const inFlightRequests = new Map<string, number>(); // key -> timestamp

// Exported for test reset
export function __resetInFlightRequests() {
  inFlightRequests.clear();
}

/**
 * Hook for sending analytics view beacons.
 * Client-side deduplication (best effort; server advisory lock is the authority).
 * Silent failure — never breaks content rendering.
 */
export function useAnalyticsBeacon() {
  const sentKeys = useRef<Set<string>>(new Set());
  const consent = useAnalyticsConsent();

  const sendBeacon = useCallback(
    async (payload: BeaconPayload) => {
      if (!consent) return;

      const visitorId = getVisitorId();
      const dedupKey = `${payload.content_type}:${payload.content_id}:${visitorId}`;
      const now = Date.now();

      // Client-side suppression (best effort; server is authority)
      const lastSent = inFlightRequests.get(dedupKey);
      if (lastSent && now - lastSent < DEDUP_WINDOW_MS) {
        return; // Suppressed
      }
      if (sentKeys.current.has(dedupKey)) {
        return; // Already sent this session
      }

      inFlightRequests.set(dedupKey, now);
      sentKeys.current.add(dedupKey);

      // Cleanup old entries periodically
      if (inFlightRequests.size > 1000) {
        const cutoff = now - DEDUP_WINDOW_MS;
        for (const [key, ts] of inFlightRequests.entries()) {
          if (ts < cutoff) inFlightRequests.delete(key);
        }
      }

      try {
        // Fire-and-forget; no retry, no queue
        await analyticsApi.events.create({
          ...payload,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
        } as import("../services/analyticsApi").ViewEventPayload);
      } catch {
        // Silent failure — never break content
      }
    },
    [consent]
  );

  const trackView = useCallback(
    (contentType: "Article" | "Review" | "Wine", contentId: number) => {
      if (!consent) return;

      const nav = getNavigationContext();
      sendBeacon({
        event_type: "view",
        content_type: contentType,
        content_id: contentId,
        occurred_at: new Date().toISOString(),
        source: nav.source,
        referrer: nav.referrer,
      });
    },
    [consent, sendBeacon]
  );

  const handleOptOut = useCallback(() => {
    clearVisitorId();
  }, []);

  return { trackView, handleOptOut };
}