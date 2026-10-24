import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { winePackagesApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { canAccessPackages } from "../constants/roles";
import usePagedList from "../hooks/usePagedList";
import Pagination from "./Pagination";
import PackageStatusBadge from "./PackageStatusBadge";
import {
  PACKAGE_STATUSES,
  PACKAGE_SOURCES,
  sourceLabel,
  statusLabel,
} from "../constants/winePackages";
import { formatDate, deadlineLabel } from "../utils/dates";
import DetailHero from "./DetailHero";
import styles from "./winePackages.module.css";

// Wine packages list: every shipment a reviewer is responsible for, with the
// review deadline front and centre. Filters live in the URL so a filtered view
// can be bookmarked and shared.
function WinePackages() {
  const { user } = useAuth();
  const canCreate = canAccessPackages(user);
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get("status") || "";
  const source = searchParams.get("source") || "";
  const overdue = searchParams.get("overdue") === "true";
  const query = searchParams.get("query") || "";
  const [queryDraft, setQueryDraft] = useState(query);

  const list = usePagedList({
    fetcher: (params) => winePackagesApi.list(params),
    extraParams: { status, source, overdue: overdue ? "true" : "", query },
  });

  // Filters reset pagination: staying on page 3 of a narrower list would
  // usually show an empty page.
  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    setSearchParams(params);
  }

  function submitQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilter("query", queryDraft.trim());
  }

  if (list.loading) {
    return (
      <div className="wine-app">
        <p className="wine-management__loading">Loading wine packages…</p>
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

  return (
    <div className="wine-app">
      <Link to="/" className="wine-detail__back">
        &larr; Back to Dashboard
      </Link>
      <DetailHero
        kicker="Cellar"
        title="Wine Packages"
        intro="Wines received from producers, and the reviews they still need."
        actions={
          canCreate && (
            <div className={styles.headerActions}>
              <Link
                to="/wine-packages/new?mode=arrived"
                className="wine-btn wine-btn--primary"
              >
                + Record Received Package
              </Link>
              <Link
                to="/wine-packages/new?mode=announced"
                className="wine-btn wine-btn--primary"
              >
                + Add Expected Package
              </Link>
            </div>
          )
        }
      />

      <div className={styles.filters}>
        <div className={styles.filterField}>
          <label htmlFor="package-status">Status</label>
          <select
            id="package-status"
            value={status}
            onChange={(event) => setFilter("status", event.target.value)}
          >
            <option value="">All statuses</option>
            {PACKAGE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterField}>
          <label htmlFor="package-source">Source</label>
          <select
            id="package-source"
            value={source}
            onChange={(event) => setFilter("source", event.target.value)}
          >
            <option value="">All sources</option>
            {PACKAGE_SOURCES.map((value) => (
              <option key={value} value={value}>
                {sourceLabel(value)}
              </option>
            ))}
          </select>
        </div>

        <label className={styles.checkboxField} htmlFor="package-overdue">
          <input
            id="package-overdue"
            type="checkbox"
            checked={overdue}
            onChange={(event) => setFilter("overdue", event.target.checked ? "true" : "")}
          />
          Overdue only
        </label>

        <form className={styles.filterField} onSubmit={submitQuery}>
          <label htmlFor="package-query">Search</label>
          <input
            id="package-query"
            type="search"
            placeholder="Producer, notes or tracking"
            value={queryDraft}
            onChange={(event) => setQueryDraft(event.target.value)}
          />
        </form>
      </div>

      {list.items.length === 0 ? (
        <div className="wine-management__empty">
          <p>No wine packages found.</p>
          {canCreate && (
            <Link to="/wine-packages/new?mode=arrived" className="wine-btn wine-btn--primary">
              Record Your First Package
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Producer</th>
                  <th scope="col">Status</th>
                  <th scope="col">Source</th>
                  <th scope="col">Dates</th>
                  <th scope="col">Review deadline</th>
                  <th scope="col">Reviews</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((pkg) => (
                  <tr key={pkg.id}>
                    <td>
                      <Link to={`/wine-packages/${pkg.id}`} className={styles.producerLink}>
                        {pkg.producer_name || `Package #${pkg.id}`}
                      </Link>
                      {pkg.reviewer_name && (
                        <div className={styles.cellMuted}>Reviewer: {pkg.reviewer_name}</div>
                      )}
                    </td>
                    <td>
                      <PackageStatusBadge status={pkg.status} />
                      {pkg.auto_completed && (
                        <div className={styles.cellMuted}>completed automatically</div>
                      )}
                    </td>
                    <td className={styles.cellMuted}>{sourceLabel(pkg.source)}</td>
                    <td className={styles.cellMuted}>
                      {pkg.arrived_at ? (
                        <div>Arrived {formatDate(pkg.arrived_at)}</div>
                      ) : pkg.expected_at ? (
                        <div>Expected {formatDate(pkg.expected_at)}</div>
                      ) : (
                        <div>—</div>
                      )}
                    </td>
                    <td>
                      {pkg.review_deadline ? (
                        <span
                          className={
                            pkg.overdue ? styles.overdue : undefined
                          }
                        >
                          {formatDate(pkg.review_deadline)}
                          <div className={styles.cellMuted}>
                            {deadlineLabel(pkg.review_deadline)}
                          </div>
                        </span>
                      ) : (
                        <span className={styles.cellMuted}>—</span>
                      )}
                    </td>
                    <td className={styles.cellMuted}>
                      {pkg.review_progress?.requested > 0 ? (
                        <>
                          {pkg.review_progress.percent}% ({pkg.review_progress.reviewed}/
                          {pkg.review_progress.requested})
                          {pkg.review_progress.pending > 0 && (
                            <div className={styles.overdue}>
                              {pkg.review_progress.pending} pending
                            </div>
                          )}
                        </>
                      ) : (
                        `${pkg.items_count} item(s)`
                      )}
                    </td>
                    <td>
                      <Link
                        to={`/wine-packages/${pkg.id}`}
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

export default WinePackages;
