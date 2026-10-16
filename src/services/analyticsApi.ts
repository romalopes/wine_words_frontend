/** Analytics API client (ingestion + reporting). */

import type { ApiRequester } from "./apiClient";
import { buildQuery } from "./apiClient";
import { getVisitorId } from "../utils/analyticsIdentity";

// --- Ingestion types ---
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

// --- Reporting types ---
export interface PeriodMetadata {
  token: string;
  start_at: string;
  end_at: string;
  timezone: string;
  scope_label: string;
  partial_history: boolean;
  available_history: { from: string | null; to: string | null };
  metric_version: string;
}

export interface SummaryResponse {
  views: number;
  unique_viewers: number;
  likes: number;
  comments: number;
  replies: number;
  engagement_rate: number;
  engagement_denominator_zero: boolean;
  content_count: number;
  period: PeriodMetadata;
}

export interface TopContentRow {
  content_type: "Article" | "Review" | "Wine";
  content_id: number;
  title: string;
  published_at: string | null;
  author_name: string | null;
  views: number;
  unique_viewers: number;
  likes: number;
  comments: number;
  replies: number;
  engagement_rate: number;
  engagement_denominator_zero: boolean;
}

export interface TopContentResponse {
  rows: TopContentRow[];
  total: number;
  page: number;
  per_page: number;
  sort: string;
  direction: string;
  period: PeriodMetadata;
}

export interface ContentDetailResponse {
  content_type: "Article" | "Review" | "Wine";
  content_id: number;
  title: string;
  published_at: string | null;
  author_name: string | null;
  views: number;
  unique_viewers: number;
  likes: number;
  comments: number;
  replies: number;
  engagement_rate: number;
  engagement_denominator_zero: boolean;
  time_series?: TimeSeriesBucket[];
  period: PeriodMetadata;
}

export interface TimeSeriesBucket {
  period_start: string;
  period_end: string;
  views: number;
  unique_viewers: number;
}

export interface TimeseriesResponse {
  buckets: TimeSeriesBucket[];
  total_views: number;
  grouping: "day" | "week" | "month";
  period: PeriodMetadata;
}

export interface WineInsightGroup {
  id: number;
  slug: string | null;
  name: string;
  views: number;
  unique_viewers: number;
  color?: string | null;
}

export interface WineInsightsResponse {
  grouping: "producer" | "region" | "grape";
  groups: WineInsightGroup[];
  period: PeriodMetadata;
  overlapping_notice: string | null;
}

export type WineInsightsParams = Omit<ReportingParams, "sort" | "grouping"> & {
  grouping?: "producer" | "region" | "grape";
  sort?: "views" | "unique_viewers" | "name";
};

export interface ReportingParams {
  period?: "7d" | "30d" | "90d" | "1y" | "all";
  start_date?: string;
  end_date?: string;
  content_type?: "article" | "review" | "wine" | "all";
  sort?: "views" | "engagement" | "published_at";
  direction?: "asc" | "desc";
  page?: number;
  per_page?: number;
  include_zero_views?: boolean;
  grouping?: "day" | "week" | "month" | "none";
  author_id?: number;
}

// --- Full API ---
export interface AnalyticsApi {
  events: {
    create(payload: ViewEventPayload): Promise<ViewEventResponse>;
  };
  reports: {
    summary(params?: ReportingParams): Promise<SummaryResponse>;
    topContent(params?: ReportingParams): Promise<TopContentResponse>;
    contentDetail(contentType: string, contentId: string | number, params?: ReportingParams): Promise<ContentDetailResponse>;
    timeseries(params?: ReportingParams): Promise<TimeseriesResponse>;
    wineInsights(params?: WineInsightsParams): Promise<WineInsightsResponse>;
  };
}

export function createAnalyticsApi(request: ApiRequester): AnalyticsApi {
  return {
    events: {
      async create(payload: ViewEventPayload): Promise<ViewEventResponse> {
        return request<ViewEventResponse>("/analytics/views", {
          method: "POST",
          auth: true,
          headers: { "X-Visitor-ID": getVisitorId() },
          body: JSON.parse(JSON.stringify(payload)),
        });
      },
    },
    reports: {
      async summary(params?: ReportingParams): Promise<SummaryResponse> {
        return request<SummaryResponse>(`/analytics/summary${buildQuery({ ...params })}`, { auth: true });
      },
      async topContent(params?: ReportingParams): Promise<TopContentResponse> {
        return request<TopContentResponse>(`/analytics/top_content${buildQuery({ ...params })}`, { auth: true });
      },
      async contentDetail(contentType: string, contentId: string | number, params?: ReportingParams): Promise<ContentDetailResponse> {
        return request<ContentDetailResponse>(`/analytics/content/${contentType}/${contentId}${buildQuery({ ...params })}`, { auth: true });
      },
      async timeseries(params?: ReportingParams): Promise<TimeseriesResponse> {
        return request<TimeseriesResponse>(`/analytics/timeseries${buildQuery({ ...params })}`, { auth: true });
      },
      async wineInsights(params?: WineInsightsParams): Promise<WineInsightsResponse> {
        return request<WineInsightsResponse>(`/analytics/wine-insights${buildQuery({ ...params })}`, { auth: true });
      },
    },
  };
}