import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { tradeApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { canManageAllPackages } from "../constants/roles";
import usePagedList from "../hooks/usePagedList";
import Pagination from "./Pagination";
import PackageStatusBadge from "./PackageStatusBadge";
import { statusLabel } from "../constants/winePackages";
import { formatDate } from "../utils/dates";
import DetailHero from "./DetailHero";
import styles from "./trade.module.css";
import type { TradePackage } from "../types/trade";

// Admin list of trade submissions (IDENTITY_206 Phase 7).
// Filterable, paginated queue with search and status filter.
export default function TradeAdminPackagesList() {
  const { user } = useAuth();
  const allowed = canManageAllPackages(user);
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get("status") || "";
  const query = searchParams.get("q") || "";
  const [queryDraft, setQueryDraft] = useState(query);

  const list = usePagedList<TradePackage>({
    fetcher: async (params) => {
      const response = await tradeApi.listStaffPackages({
        status: params.status || "",
        q: params.q || "",
        page: params.page,
        per_page: params.per_page,
      });
      return {
        items: response.packages,
        page: Math.floor((response.meta.offset || 0) / (response.meta.limit || 25)) + 1,
        per_page: response.meta.limit || 25,
        total_count: response.meta.total_count || 0,
        total_pages: Math.ceil((response.meta.total_count || 0) / (response.meta.limit || 25)),
      };
    },
    extraParams: { status, q: query },
  });

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    setSearchParams(params);
  }

  function submitQuery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilter("q", queryDraft.trim());
  }

  if (!allowed) {
    return (
      <div className={styles.page}>
        <DetailHero
          className="wine-app__detail-hero--trade"
          title="Trade submissions"
          intro="This page is restricted to Editor and Admin accounts."
        />
      </div>
    );
  }

  if (list.loading) {
    return (
      <div className="wine-app">
        <p className="wine-management__loading">Loading submissions...</p>
      </div>
    );
  }

  if (list.error) {
    return (
      <div className="wine-app">
        <p className="wine-management__error">{list.error}</p>
        <button className="wine-btn wine-btn--primary" onClick={list.reload}>
          Retry
        </button>
      </div>
    );
  }

  const statuses = [
    "",
    "editorial_pending",
    "assessment_in_progress",
    "partially_approved",
    "approved",
    "rejected",
    "quoted",
    "invoiced",
    "paid",
    "shipping_pending",
    "shipping_released",
    "in_transit",
    "arrived",
    "reviewing",
    "completed",
    "cancelled",
  ];

  return (
    <div className="wine-app">
      <DetailHero
        className="wine-app__detail-hero--trade"
        title="Trade submissions"
        intro="Manage incoming wine submissions from producers and agents."
      />

      <form onSubmit={submitQuery} className={styles.searchForm}>
        <input
          type="search"
          placeholder="Search company, contact, email..."
          value={queryDraft}
          onChange={(e) => setQueryDraft(e.target.value)}
          className={styles.searchInput}
        />
        <select
          value={status}
          onChange={(e) => setFilter("status", e.target.value)}
          className={styles.statusFilter}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s ? statusLabel(s) : "All statuses"}
            </option>
          ))}
        </select>
        <button type="submit" className="wine-btn wine-btn--primary">
          Search
        </button>
        {query && (
          <button
            type="button"
            className="wine-btn wine-btn--secondary"
            onClick={() => setFilter("q", "")}
          >
            Clear
          </button>
        )}
      </form>

      {list.items.length === 0 ? (
        <div className={styles.card}>
          <p className={styles.muted}>No submissions found.</p>
        </div>
      ) : (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Status</th>
                  <th>Submitter</th>
                  <th>Submitted</th>
                  <th>Wines</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.items.map((pkg) => (
                  <tr key={pkg.id}>
                    <td>
                      <Link to={`/admin/trade/packages/${pkg.id}`} className={styles.packageLink}>
                        #{pkg.id}
                      </Link>
                    </td>
                    <td>
                      <PackageStatusBadge status={pkg.status} />
                    </td>
                    <td>
                      <div>
                        <strong>{pkg.contact_snapshot?.company_name || "---"}</strong>
                        <div className={styles.muted}>
                          {pkg.contact_snapshot?.contact_name || "---"}
                          &nbsp;.&nbsp;
                          {pkg.contact_snapshot?.email || "---"}
                        </div>
                      </div>
                    </td>
                    <td>
                      {pkg.submitted_at ? formatDate(pkg.submitted_at) : "---"}
                    </td>
                    <td>{pkg.items.length}</td>
                    <td>
                      <Link
                        to={`/admin/trade/packages/${pkg.id}`}
                        className="wine-btn wine-btn--ghost wine-btn--sm"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={list.page}
            totalPages={list.totalPages}
            totalCount={list.totalCount}
            onPageChange={list.setPage}
 />
        </>
      )}
    </div>
  );
}
