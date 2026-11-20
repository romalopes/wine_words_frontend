import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { analyticsApi } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { canAccessAnalytics } from "../../constants/roles";
import { formatEngagementsPer100Views, formatNumber } from "../../utils/format";
import { ContentTable } from "./ContentTable";
import { TimeseriesChart } from "./TimeseriesChart";
import DetailHero from "../DetailHero";
import type {
  ReportingParams,
  SummaryResponse,
  TopContentResponse,
  TopContentRow,
  TimeseriesResponse,
} from "../../services/analyticsApi";
import styles from "./AnalyticsDashboard.module.css";

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
  <div className={styles.kpiCard + (warning ? " " + styles.kpiCardWarning : "")}>
    <div className={styles.kpiTitle}>{title}</div>
    <div className={styles.kpiValue}>{value}</div>
    {subtitle && <div className={styles.kpiSubtitle + (warning ? " " + styles.kpiCardWarning : "")}>{subtitle}</div>}
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
        analyticsApi.reports.timeseries({ period: params.period!, grouping: timeseriesGrouping }),
      ]);

      setSummary(summaryRes);
      setTopContent(topContentRes);
      setTimeseries(timeseriesRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics data.");
      console.error(err);
    } finally {
      setSummaryLoading(false);
      setTopContentLoading(false);
      setTimeseriesLoading(false);
    }
  }, [period, typeFilter, sort, direction, page, perPage, includeZeroViews, timeseriesGrouping]);

  useEffect(() => {
    if (hasReportingAccess) {
      fetchAll();
    }
  }, [fetchAll, hasReportingAccess]);

  const handlePeriodChange = (value: string) => {
    setPeriod(value as AnalyticsPeriod);
    setPage(1);
  };

  const handleTypeFilterChange = (value: string) => {
    setTypeFilter(value as ContentTypeFilter);
    setPage(1);
  };

  const handleSort = (field: string) => {
    // Map ContentTable field names to API sort parameters
    const sortMap: Record<string, AnalyticsSort> = {
      views: "views",
      engagement_rate: "engagement",
      published_at: "published_at",
    };
    const newSort = sortMap[field];
    if (!newSort) return; // Ignore unsortable fields

    if (newSort === sort) {
      setDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(newSort);
      setDirection("desc");
    }
    setPage(1);
  };

  const handleRowClick = (row: TopContentRow) => {
    navigate(`/analytics/content/${row.content_type}/${row.content_id}`);
  };

  if (!hasReportingAccess) {
    return (
      <main className={styles.page}>
        <DetailHero
          kicker="Analytics"
          title="Analytics"
          intro="You don't have permission to view analytics."
        />
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <DetailHero
        kicker="Analytics"
        title="Analytics"
        intro="Content performance overview for the selected period."
        actions={
          <div className={styles.heroActions}>
            <div className={styles.controlGroup}>
              <label htmlFor="analytics-period" className={styles.controlLabel}>
                Period
              </label>
              <select
                id="analytics-period"
                value={period}
                onChange={(e) => handlePeriodChange(e.target.value)}
                className={styles.select}
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.controlGroup}>
              <label htmlFor="analytics-type" className={styles.controlLabel}>
                Content Type
              </label>
              <select
                id="analytics-type"
                value={typeFilter}
                onChange={(e) => handleTypeFilterChange(e.target.value)}
                className={styles.select}
              >
                {CONTENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={includeZeroViews}
                onChange={(e) => setIncludeZeroViews(e.target.checked)}
              />
              Include items with zero views
            </label>

            <a href="/analytics/wine-insights" className="wine-btn wine-btn--secondary wine-btn--sm">
              Wine Insights
            </a>
          </div>
        }
      />

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.contentWrapper}>
        {summary && (
          <section className={styles.kpiGrid} aria-label="Key metrics">
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

        <section className={styles.dashboardSection} aria-labelledby="trending-heading">
          <div className={styles.sectionHeader}>
            <h2 id="trending-heading" className={styles.sectionTitle}>Trending Views</h2>
            <select
              value={timeseriesGrouping}
              onChange={(e) => setTimeseriesGrouping(e.target.value as TimeseriesGrouping)}
              className={styles.select}
              aria-label="Time grouping"
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </div>
          <div className={styles.chartWrapper}>
            <TimeseriesChart data={timeseries} loading={timeseriesLoading} grouping={timeseriesGrouping} />
          </div>
        </section>

        <section className={styles.dashboardSection} aria-labelledby="top-content-heading">
          <div className={styles.sectionHeader}>
            <h2 id="top-content-heading" className={styles.sectionTitle}>Top Content</h2>
            <div className={styles.tableControls}>
              <select
                value={sort}
                onChange={(e) => handleSort(e.target.value as AnalyticsSort)}
                className={styles.select}
                aria-label="Sort by"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as SortDirection)}
                className={styles.select}
                aria-label="Sort direction"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
          <div className={styles.tableWrapper}>
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
          </div>
        </section>

        {summary && (
          <footer className={styles.dashboardFooter}>
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
