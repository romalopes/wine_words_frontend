import React from "react";
import { formatNumber } from "../../utils/format";

interface TimeseriesChartProps {
  data: any;
  loading: boolean;
  grouping: string;
}

export const TimeseriesChart: React.FC<TimeseriesChartProps> = ({ data, loading, grouping }) => {
  if (loading) return <div className="chart-loading">Loading chart…</div>;
  if (!data?.buckets?.length) return <div className="chart-empty">No data for this period.</div>;

  const maxViews = Math.max(...data.buckets.map((b: any) => b.views), 1);
  const barHeight = 120;

  return (
    <div className="timeseries-chart" role="img" aria-label={`Views over time (${grouping})`}>
      <div className="chart-bars" style={{ height: barHeight }}>
        {data.buckets.map((bucket: any, i: number) => (
          <div
            key={i}
            className="chart-bar"
            style={{
              height: `${(bucket.views / maxViews) * barHeight}px`,
              left: `${(i / data.buckets.length) * 100}%`,
              width: `${100 / data.buckets.length - 2}%`,
            }}
            title={`${bucket.period_start.split('T')[0]}: ${bucket.views} views, ${bucket.unique_viewers} unique viewers`}
          />
        ))}
      </div>
      <div className="chart-labels">
        {data.buckets.map((bucket: any, i: number) => (
          <span key={i} style={{ left: `${(i / data.buckets.length) * 100}%` }}>
            {new Date(bucket.period_start).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        ))}
      </div>
      <div className="chart-legend">
        Grouping: {grouping} • Total views: {formatNumber(data.total_views)}
      </div>
    </div>
  );
};