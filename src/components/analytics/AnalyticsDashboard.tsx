import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { analyticsApi } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { canAccessAnalytics } from "../../constants/roles";
import { formatNumber, formatPercent, formatDate } from "../../utils/format";
import { ContentTable } from "./ContentTable";
import { TimeseriesChart } from "./TimeseriesChart";
import { PeriodSelector } from "./PeriodSelector";
import { Link, useLocation } from "react-router-dom";

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
  { value: "engagement", label: "Engagement Rate" },
  { value: "published_at", label: "Published Date" },
];

const KPICard = ({ title, value, subtitle, warning }) => (
  <div className={`kpi-card ${warning ? "warning" : ""}`}>
    <div className="kpi-title">{title}</div>
    <div className="kpi-value">{value}</div>
    {subtitle && <div className={`kpi-subtitle ${warning ? "warning" : ""}`}>{subtitle}</div>}
  </div>
);

const AnalyticsDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [summary, setSummary] = useState(null);
  const [topContent, setTopContent] = useState(null);
  const [timeseries, setTimeseries] = useState(null);

  const [summaryLoading, setSummaryLoading] = useState(true);
  const [topContentLoading, setTopContentLoading] = useState(true);
  const [timeseriesLoading, setTimeseriesLoading] = useState(true);

  const [period, setPeriod] = useState("30d");
  const [sort, setSort] = useState("views");
  const [direction, setDirection] = useState("desc");
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [typeFilter, setTypeFilter] = useState("all");
  const [includeZeroViews, setIncludeZeroViews] = useState(true);
  const [timeseriesGrouping, setTimeseriesGrouping] = useState("day");
  const [error, setError] = useState(null);

  const hasReportingAccess = canAccessAnalytics(user);

  const fetchAll = useCallback(async () => {
    setError(null);
    setSummaryLoading(true);
    setTopContentLoading(true);
    setTimeseriesLoading(true);

    try {
      const params = {
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
      setError(err.response?.data?.error || "Failed to load analytics data");
    } finally {
      setSummaryLoading(false);
      setTopContentLoading(false);
      setTimeseriesLoading(false);
    }
  }, [period, sort, direction, page, perPage, typeFilter, includeZeroViews, timeseriesGrouping]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSort = (field) => {
    if (sort === field) {
      setDirection(direction === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setDirection("desc");
    }
    setPage(1);
  };

  const handleRowClick = (row) => {
    const typeMap = { Article: "article", Review: "review", Wine: "wine" };
    navigate(`/analytics/content/${typeMap[row.content_type]}/${row.content_id}`);
  };

  if (!hasReportingAccess) {
    return (
      <div className="analytics-dashboard">
        <div className="access-denied">
          <h2>Analytics Access Required</h2>
          <p>You need Reviewer, Editor, or Admin role to view analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      <header className="dashboard-header">
        <h1>Content Analytics</h1>
        <div className="dashboard-controls">
          <PeriodSelector
            value={period}
            onChange={(v) => { setPeriod(v); setPage(1); }}
            options={PERIOD_OPTIONS}
          />
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
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
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
            title="Engagement Rate"
            value={summary.engagement_denominator_zero ? "—" : formatPercent(summary.engagement_rate)}
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
            onChange={(e) => setTimeseriesGrouping(e.target.value)}
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
              onChange={(e) => handleSort(e.target.value)}
              className="sort-select"
              aria-label="Sort by"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
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
  );
};

export default AnalyticsDashboard;