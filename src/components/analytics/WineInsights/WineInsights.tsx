/** Wine Insights - aggregated Wine view analytics by Producer, Region, Grape */

import { useState, useEffect, useMemo } from "react";
import { analyticsApi } from "../../../services/api";
import type { WineInsightsResponse, WineInsightsParams } from "../../../services/analyticsApi";
import "./WineInsights.css";

type Grouping = "producer" | "region" | "grape";
type Sort = "views" | "unique_viewers" | "name";

interface WineInsightsProps {
  initialParams?: Partial<WineInsightsParams>;
}

export function WineInsights({ initialParams = {} }: WineInsightsProps) {
  const [data, setData] = useState<WineInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [params, setParams] = useState<WineInsightsParams>({
    period: "30d",
    grouping: "producer",
    sort: "views",
    direction: "desc",
    ...initialParams,
  });

  const [page, setPage] = useState(1);
  const perPage = 20;

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    analyticsApi.reports
      .wineInsights(params)
      .then((res) => {
        if (mounted) {
          setData(res);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || "Failed to load wine insights");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [params, page]);

  const handleGroupingChange = (grouping: Grouping) => {
    setParams((p) => ({ ...p, grouping }));
    setPage(1);
  };

  const handleSortChange = (sort: Sort) => {
    setParams((p) => {
      const newDirection = p.sort === sort && p.direction === "desc" ? "asc" : "desc";
      return { ...p, sort, direction: newDirection };
    });
  };

  const handlePeriodChange = (period: WineInsightsParams["period"]) => {
    if (period) {
      setParams((p) => ({ ...p, period }));
      setPage(1);
    }
  };

  const paginatedGroups = useMemo(() => {
    if (!data) return [];
    const start = (page - 1) * perPage;
    return data.groups.slice(start, start + perPage);
  }, [data, page]);

  const totalPages = data ? Math.ceil(data.groups.length / perPage) : 1;

  const formatNumber = (n: number) => n.toLocaleString();

  const getSortIndicator = (sort: Sort) => {
    if (params.sort !== sort) return null;
    return params.direction === "desc" ? " ▼" : " ▲";
  };

  if (loading) {
    return <div className="wine-insights loading">Loading wine insights…</div>;
  }

  if (error) {
    return <div className="wine-insights error">Error: {error}</div>;
  }

  if (!data || data.groups.length === 0) {
    return <div className="wine-insights empty">No wine view data for this period.</div>;
  }

  return (
    <main className="wine-app"><div className="wine-insights">
      {/* Controls */}
      <div className="wine-insights__controls">
        <div className="wine-insights__control-group">
          <label htmlFor="period">Period:</label>
          <select
            id="period"
            value={params.period || "30d"}
            onChange={(e) => handlePeriodChange(e.target.value as WineInsightsParams["period"])}
            className="wine-insights__select"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
            <option value="all">All time</option>
          </select>
        </div>

        <div className="wine-insights__control-group">
          <label>Group by:</label>
          <div className="wine-insights__grouping-tabs">
            {(["producer", "region", "grape"] as Grouping[]).map((g) => (
              <button
                key={g}
                className={`wine-insights__grouping-tab ${params.grouping === g ? "active" : ""}`}
                onClick={() => handleGroupingChange(g)}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overlapping notice */}
      {data.overlapping_notice && (
        <div className="wine-insights__notice">
          ⚠ {data.overlapping_notice}
        </div>
      )}

      {/* Table */}
      <div className="wine-insights__table-wrapper">
        <table className="wine-insights__table">
          <thead>
            <tr>
              <th>#</th>
              <th
                className={params.sort === "name" ? "sorted" : ""}
                onClick={() => handleSortChange("name")}
              >
                Name {getSortIndicator("name")}
              </th>
              <th
                className={params.sort === "views" ? "sorted" : ""}
                onClick={() => handleSortChange("views")}
              >
                Views {getSortIndicator("views")}
              </th>
              <th
                className={params.sort === "unique_viewers" ? "sorted" : ""}
                onClick={() => handleSortChange("unique_viewers")}
              >
                Unique Viewers {getSortIndicator("unique_viewers")}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedGroups.map((group, index) => (
              <tr key={group.id}>
                <td className="wine-insights__rank">
                  {(page - 1) * perPage + index + 1}
                </td>
                <td className="wine-insights__name">
                  <span className="wine-insights__entity-name">{group.name}</span>
                  {group.slug && <span className="wine-insights__slug">/{group.slug}</span>}
                  {group.color && (
                    <span className="wine-insights__color-badge" style={{ backgroundColor: group.color }}>
                      {group.color}
                    </span>
                  )}
                </td>
                <td className="wine-insights__views">{formatNumber(group.views)}</td>
                <td className="wine-insights__unique-viewers">{formatNumber(group.unique_viewers)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="wine-insights__pagination">
          <button
            className="wine-insights__page-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          <span className="wine-insights__page-info">
            Page {page} of {totalPages} ({data.groups.length} total)
          </span>
          <button
            className="wine-insights__page-btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      )}

      {/* Period metadata */}
      <div className="wine-insights__meta">
        <small>
          Period: {data.period.start_at} → {data.period.end_at} ({data.period.scope_label})
        </small>
      </div>
    </div>
    </main>
  );
}
