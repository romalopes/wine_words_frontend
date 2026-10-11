import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { analyticsApi } from "../../services/api";
import { formatNumber, formatPercent, formatDate, formatDateTime } from "../../utils/format";
import { TimeseriesChart } from "./TimeseriesChart";

interface ContentDetailPageProps {}

export const ContentAnalyticsDetail: React.FC<ContentDetailPageProps> = () => {
  const { contentType, contentId } = useParams<{ contentType: string; contentId: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("30d");
  const [grouping, setGrouping] = useState<"day" | "week" | "month">("day");

  const groupingOptions = [
    { value: "day", label: "Daily" },
    { value: "week", label: "Weekly" },
    { value: "month", label: "Monthly" },
  ];

  const periodOptions = [
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 90 days" },
    { value: "1y", label: "Last year" },
    { value: "all", label: "All time" },
  ];

  useEffect(() => {
    if (!contentType || !contentId) return;

    let cancelled = false;

    async function fetchDetail() {
      setLoading(true);
      setError(null);
      try {
        const data = await analyticsApi.reports.contentDetail(contentType, contentId, {
          period,
          grouping,
        });
        if (!cancelled) setDetail(data);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load content analytics");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDetail();
    return () => { cancelled = true; };
  }, [contentType, contentId, period, grouping]);

  if (loading) {
    return <div className="analytics-detail-loading">Loading analytics…</div>;
  }

  if (error) {
    return (
      <div className="analytics-detail-error">
        <p>{error}</p>
        <button onClick={() => navigate("/analytics")} className="btn btn-secondary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!detail) {
    return <div className="analytics-detail-empty">No data available.</div>;
  }

  const typeBadgeClass = (type: string) => {
    switch (type) {
      case "Article": return "badge-article";
      case "Review": return "badge-review";
      case "Wine": return "badge-wine";
      default: return "";
    }
  };

  const formatKpi = (value: number | null | undefined, isPercent = false) => {
    return isPercent ? formatPercent(value) : formatNumber(value);
  };

  return (
    <main className="wine-app"><div className="analytics-detail">
      <header className="analytics-detail__header">
        <Link to="/analytics" className="analytics-detail__back" onClick={() => navigate("/analytics")}>
          ← Back to Dashboard
        </Link>
        <div className="analytics-detail__title-block">
          <h1 className="analytics-detail__title">{detail.title}</h1>
          <div className="analytics-detail__meta">
            <span className={`content-type-badge ${typeBadgeClass(detail.content_type)}`}>{detail.content_type}</span>
            <span className="analytics-detail__divider">•</span>
            <span>Published: {detail.published_at ? formatDate(detail.published_at) : "—"}</span>
            <span className="analytics-detail__divider">•</span>
            <span>Author: {detail.author_name || "—"}</span>
          </div>
        </div>
      </header>

      <section className="analytics-detail__kpis" aria-label="Key metrics">
        <div className="kpi-grid">
          <article className="kpi-card">
            <span className="kpi-label">Views</span>
            <span className="kpi-value">{formatKpi(detail.views)}</span>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">Unique Viewers</span>
            <span className="kpi-value">{formatKpi(detail.unique_viewers)}</span>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">Likes</span>
            <span className="kpi-value">{formatKpi(detail.likes)}</span>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">Comments</span>
            <span className="kpi-value">{formatKpi(detail.comments)}</span>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">Replies</span>
            <span className="kpi-value">{formatKpi(detail.replies)}</span>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">Engagement Rate</span>
            <span className="kpi-value">
              {detail.engagement_denominator_zero ? "—" : formatKpi(detail.engagement_rate, true)}
            </span>
          </article>
        </div>
      </section>

      <section className="analytics-detail__chart" aria-label="Views over time">
        <div className="analytics-detail__chart-controls">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="period-select"
            aria-label="Reporting period"
          >
            {periodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={grouping}
            onChange={(e) => setGrouping(e.target.value as "day" | "week" | "month")}
            className="grouping-select"
            aria-label="Time grouping"
          >
            {groupingOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <TimeseriesChart
          data={detail.time_series ? { buckets: detail.time_series, total_views: detail.views, grouping } : null}
          loading={false}
          grouping={grouping}
        />
      </section>

      <footer className="analytics-detail__footer">
        <div className="period-info">
          <strong>Period:</strong> {detail.period?.scope_label || period}
          <span className="divider">|</span>
          <strong>Timezone:</strong> {detail.period?.timezone || "UTC"}
          {detail.period?.partial_history && (
            <>
              <span className="divider">|</span>
              <span className="partial-history">Partial history</span>
            </>
          )}
        </div>
      </footer>
    </div>
    </main>
  );
};

export default ContentAnalyticsDetail;