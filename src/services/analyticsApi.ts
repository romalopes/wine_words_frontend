/** Analytics ingestion API client. */

import type { ApiRequester } from "./apiClient";
import { getVisitorId } from "../utils/analyticsIdentity";

export interface AnalyticsApi {
  events: {
    create(payload: ViewEventPayload): Promise<ViewEventResponse>;
  };
}

export interface ViewEventPayload {
  event_type: "view";
  content_type: "Article" | "Review" | "Wine";
  content_id: number;
  occurred_at: string;
  source?: "direct" | "search" | "internal" | "external";
  referrer?: string;
  viewport?: string;
}

export interface ViewEventResponse {
  accepted: boolean;
}

export function createAnalyticsApi(request: ApiRequester): AnalyticsApi {
  return {
    events: {
      async create(payload: ViewEventPayload): Promise<ViewEventResponse> {
        // Always send the visitor UUID: the server uses it for anonymous
        // identity and rolling 30-minute deduplication. Authenticated requests
        // ALSO send it so anonymous history stays linkable pre-login.
        // auth: true attaches the Bearer token when present, sends none when
        // absent (anonymous), and surfaces 401 for invalid tokens.
        return request<ViewEventResponse>("/analytics/views", {
          method: "POST",
          auth: true,
          headers: { "X-Visitor-ID": getVisitorId() },
          body: JSON.parse(JSON.stringify(payload)),
        });
      },
    },
  };
}