import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { analyticsApi } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { canAccessAnalytics } from "../../constants/roles";
import { formatEngagementsPer100Views, formatNumber } from "../../utils/format";
import { ContentTable } from "./ContentTable";
import { TimeseriesChart } from "./TimeseriesChart";
import type {
  ReportingParams,
  SummaryResponse,
  TopContentResponse,
  TopContentRow,
  TimeseriesResponse,
} from "../../services/analyticsApi";

const PERIOD_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "1y", label: "Last year" },
  { value: "all", label: "All time" },
];

const CONTENT_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "article", label: "Articles" },
  { value: "review", label: "Reviews" },
  { value: "wine", label: "Wines" },
];

const SORT_OPTIONS = [
  { value: "views", label: "Views" },
  { value: "engagement", label: "Engagements per 100 Views" },
  { value: "published_at", label: "Published Date" },
];

const KPICard = ({
  title,
  value,
  subtitle,
  warning,
}: {
  title: string;
  value: string;
  subtitle?: string | undefined;
  warning?: boolean | undefined;
}) => (
  <div className={`kpi-card ${warning ? "warning" : ""}`}>
    <div className="kpi-title">{title}</div>
    <div className="kpi-value">{value}</div>
    {subtitle && <div className={`kpi-subtitle ${warning ? "warning" : ""}`}>{subtitle}</div>}
  </div>
);

type AnalyticsPeriod = "7d" | "30d" | "90d" | "1y" | "all";
type AnalyticsSort = "views" | "engagement" | "published_at";
type SortDirection = "asc" | "desc";
type ContentTypeFilter = "all" | "article" | "review" | "wine";
type TimeseriesGrouping = "day" | "week" | "month";

const AnalyticsDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [topContent, setTopContent] = useState<TopContentResponse | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesResponse | null>(null);

  const [, setSummaryLoading] = useState(true);
  const [topContentLoading, setTopContentLoading] = useState(true);
  const [timeseriesLoading, setTimeseriesLoading] = useState(true);

  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const [sort, setSort] = useState<AnalyticsSort>("views");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [typeFilter, setTypeFilter] = useState<ContentTypeFilter>("all");
  const [includeZeroViews, setIncludeZeroViews] = useState(true);
  const [timeseriesGrouping, setTimeseriesGrouping] =
    useState<TimeseriesGrouping>("day");
  const [error, setError] = useState<string | null>(null);

  const hasReportingAccess = canAccessAnalytics(user);

  const fetchAll = useCallback(async () => {
    setError(null);
    setSummaryLoading(true);
    setTopContentLoading(true);
    setTimeseriesLoading(true);

    try {
      const params: ReportingParams = {
        period,
        content_type: typeFilter,
        sort,
        direction,
        page,
        per_page: perPage,
        include_zero_views: includeZeroViews,
        grouping: timeseriesGrouping,
      };

      const [summaryRes, topContentRes, timeseriesRes] = await Promise.all([
        analyticsApi.reports.summary(params),
        analyticsApi.reports.topContent(params),
        analyticsApi.reports.timeseries({ period, grouping: timeseriesGrouping }),
      ]);

      setSummary(summaryRes);
      setTopContent(topContentRes);
      setTimeseries(timeseriesRes);
    } catch (err) {
      console.error("Failed to load analytics:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load analytics data",
      );
    } finally {
      setSummaryLoading(false);
      setTopContentLoading(false);
      setTimeseriesLoading(false);
    }
  }, [period, sort, direction, page, perPage, typeFilter, includeZeroViews, timeseriesGrouping]);

  useEffect(() => {
    if (hasReportingAccess) void fetchAll();
  }, [fetchAll, hasReportingAccess]);

  const handleSort = (field: string) => {
    if (sort === field) {
      setDirection(direction === "asc" ? "desc" : "asc");
    } else {
      setSort(field as AnalyticsSort);
      setDirection("desc");
    }
    setPage(1);
  };

  const handleRowClick = (row: TopContentRow) => {
    const typeMap: Record<string, string> = { Article: "article", Review: "review", Wine: "wine" };
    navigate(`/analytics/content/${typeMap[row.content_type]}/${row.content_id}`);
  };

  if (!hasReportingAccess) {
    return (
      <main className="wine-app">
        <div className="analytics-dashboard">
          <div className="access-denied">
            <h2>Analytics Access Required</h2>
            <p>You need Reviewer, Editor, or Admin role to view analytics.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="wine-app">
      <div className="analytics-dashboard">
      <header className="analytics-dashboard__header">
        <h1>Content Analytics</h1>
        <div className="analytics-dashboard__controls">
          <select
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value as AnalyticsPeriod);
              setPage(1);
            }}
            className="period-select"
            aria-label="Reporting period"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeZeroViews}
              onChange={(e) => { setIncludeZeroViews(e.target.checked); setPage(1); }}
            />
            Include zero-view content
          </label>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as ContentTypeFilter);
              setPage(1);
            }}
            className="type-filter"
            aria-label="Content type filter"
          >
            {CONTENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Main Navigation Tabs */}
      <nav className="analytics-tabs" aria-label="Analytics sections">
        <Link
          to="/analytics"
          className={location.pathname === "/analytics" ? "active" : ""}
        >
          Overview
        </Link>
        <Link
          to="/analytics/wine-insights"
          className={location.pathname === "/analytics/wine-insights" ? "active" : ""}
        >
          Wine Insights
        </Link>
      </nav>

      {error && <div className="error-banner" role="alert">{error}</div>}

      {summary && (
        <section className="kpi-grid" aria-label="Key metrics">
          <KPICard title="Total Views" value={formatNumber(summary.views)} subtitle="Content views in period" />
          <KPICard title="Unique Viewers" value={formatNumber(summary.unique_viewers)} subtitle="Distinct visitors" />
          <KPICard title="Likes" value={formatNumber(summary.likes)} />
          <KPICard title="Comments" value={formatNumber(summary.comments)} />
          <KPICard title="Replies" value={formatNumber(summary.replies)} />
          <KPICard
            title="Engagements per 100 Views"
            value={summary.engagement_denominator_zero ? "—" : formatEngagementsPer100Views(summary.engagement_rate)}
            subtitle={summary.engagement_denominator_zero ? "(no views in period)" : undefined}
            warning={summary.engagement_denominator_zero}
          />
          <KPICard title="Content Items" value={formatNumber(summary.content_count)} subtitle="In your scope" />
        </section>
      )}

      <section className="dashboard-section" aria-labelledby="trending-heading">
        <div className="section-header">
          <h2 id="trending-heading">Trending Views</h2>
          <select
            value={timeseriesGrouping}
            onChange={(e) =>
              setTimeseriesGrouping(e.target.value as TimeseriesGrouping)
            }
            className="grouping-select"
            aria-label="Time grouping"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
        </div>
        <TimeseriesChart data={timeseries} loading={timeseriesLoading} grouping={timeseriesGrouping} />
      </section>

      <section className="dashboard-section" aria-labelledby="top-content-heading">
        <div className="section-header">
          <h2 id="top-content-heading">Top Content</h2>
          <div className="table-controls">
            <select
              value={sort}
              onChange={(e) => handleSort(e.target.value as AnalyticsSort)}
              className="sort-select"
              aria-label="Sort by"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as SortDirection)}
              className="direction-select"
              aria-label="Sort direction"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>
        <ContentTable
          rows={topContent?.rows || []}
          total={topContent?.total || 0}
          page={page}
          perPage={perPage}
          sort={sort}
          direction={direction}
          onSort={handleSort}
          onPageChange={setPage}
          loading={topContentLoading}
          onRowClick={handleRowClick}
        />
      </section>

      {summary && (
        <footer className="dashboard-footer">
          <details>
            <summary>Period & Scope Details</summary>
            <pre>{JSON.stringify(summary.period, null, 2)}</pre>
          </details>
        </footer>
      )}
    </div>
    </main>
  );
};

export default AnalyticsDashboard;