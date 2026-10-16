import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { isAdmin } from "../constants/roles";
import { logsApi } from "../services/api";
import { copyText } from "../utils/clipboard";
import Pagination from "./Pagination";

import type { AuditLog } from "../types/user";
const LINE_COUNT_OPTIONS = [100, 250, 500, 1000, 2000];
const PER_PAGE_OPTIONS = [10, 20, 50, 100];

// Audit action values the system can emit (CRUD verbs plus the custom action
// names declared on the controllers: account_update, password_change, role_change,
// subscription_change, authentication).
const AUDIT_ACTION_OPTIONS = [
  "create",
  "update",
  "destroy",
  "account_update",
  "password_change",
  "role_change",
  "subscription_change",
  "authentication",
];

// Object types the audit system can attach to (the domain models covered by
// the existing auditable declarations across controllers).
const AUDIT_OBJECT_TYPE_OPTIONS = [
  "Account",
  "User",
  "Producer",
  "Wine",
  "WineProfile",
  "Review",
  "Article",
  "Category",
  "Grape",
  "Country",
  "Region",
  "Vintage",
  "Subscription",
  "Session",
  "Image",
  "TasteParameter",
];

const EMPTY_FILTERS = {
  user_id: "",
  action: "",
  object_type: "",
  object_id: "",
  date_from: "",
  date_to: "",
  request_id: "",
  search: "",
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function objectsSummary(entry: AuditLog) {
  const objects = entry.objects || [];
  if (objects.length === 0) return "—";
  return objects
    .map((o) => (o.label ? `${o.type} #${o.id} (${o.label})` : `${o.type} #${o.id}`))
    .join(", ");
}

// Seed audit filters from the URL (e.g. /admin/logs?request_id=xyz arrived
// from the detail page) while ignoring unknown params.
function filtersFromSearchParams(searchParams: URLSearchParams) {
  const next = { ...EMPTY_FILTERS };
  (Object.keys(EMPTY_FILTERS) as Array<keyof typeof EMPTY_FILTERS>).forEach((key) => {
    const value = searchParams.get(key);
    if (value) next[key] = value;
  });
  return next;
}

// Legacy view: raw tail of the Rails log file (log/<env>.log), unchanged.
function LogFileViewer() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lineCount, setLineCount] = useState(500);
  const [copyState, setCopyState] = useState("idle"); // idle | copied | failed
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  function handleCopyAll() {
    copyText(logs.join("\n"))
      .then(() => setCopyState("copied"))
      .catch(() => setCopyState("failed"))
      .finally(() => {
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopyState("idle"), 1500);
      });
  }

  async function fetchLogs() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await logsApi.fetchLines(lineCount);
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, lineCount]);

  return (
    <section>
      <h2>Application Log (file)</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <label htmlFor="line-count" style={{ fontSize: 14 }}>Show last:</label>
        <select
          id="line-count"
          value={lineCount}
          onChange={(e) => setLineCount(parseInt(e.target.value, 10))}
          disabled={loading}
        >
          {LINE_COUNT_OPTIONS.map((n) => (
            <option key={n} value={n}>{n} lines</option>
          ))}
        </select>
        <button
          type="button"
          className="logCopyBtn"
          data-copied={copyState === "copied"}
          disabled={loading || logs.length === 0}
          onClick={handleCopyAll}
          aria-label="Copy entire log"
          title="Copy entire log"
          style={{ marginLeft: 8 }}
        >
          {copyState === "copied"
            ? "Copied ✓"
            : copyState === "failed"
            ? "Failed"
            : "Copy"}
        </button>
        <button
          type="button"
          className="auth-form__submit"
          disabled={loading}
          onClick={fetchLogs}
          style={{ marginLeft: "auto" }}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {error && <p style={{ color: "#b00", marginBottom: 12 }}>{error}</p>}
      <pre style={{
        background: "#1e1e1e",
        color: "#d4d4d4",
        padding: 16,
        borderRadius: 6,
        fontSize: 12,
        lineHeight: 1.5,
        overflow: "auto",
        maxHeight: "calc(100vh - 260px)",
        fontFamily: "monospace",
        margin: 0,
      }}>
                {logs.length === 0 && !loading && "No log entries found."}
        {logs.map((line, i) => (
          <span key={i} style={{ display: "block" }}>{line}</span>
        ))}
      </pre>
    </section>
  );
}

// Database audit trail: paginated, filterable table of LogService entries.
function AuditLogTable() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => filtersFromSearchParams(searchParams));
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [entries, setEntries] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<{
    page: number;
    perPage: number;
    totalCount: number;
    totalPages: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTimer, setSearchTimer] = useState<
    ReturnType<typeof setTimeout> | null
  >(null);

  function applyFilters(
    nextPage: number,
    nextFilters = filters,
    nextPerPage = perPage,
  ) {
    const requested = {
      page: nextPage,
      per_page: nextPerPage,
      ...Object.fromEntries(
        Object.entries(nextFilters).filter(([, value]) => value !== ""),
      ),
    };
    setLoading(true);
    setError(null);
    logsApi
      .fetchAuditLogs(requested)
      .then((data) => {
        if (Array.isArray(data)) {
          // Plain-array response (no page param) — shouldn't happen here but
          // degrade gracefully.
          setEntries(data);
          setPagination(null);
        } else {
          setEntries(Array.isArray(data.items) ? data.items : []);
          setPagination({
            page: data.page ?? 1,
            perPage: data.per_page ?? nextPerPage,
            totalCount: data.total_count ?? 0,
            totalPages: data.total_pages ?? 1,
          });
        }
      })
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Failed to load audit logs",
        ),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    applyFilters(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage]);

  function handleFilterChange(
    key: keyof typeof EMPTY_FILTERS,
    value: string,
  ) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    applyFilters(1);
  }

  // Debounced free-text search across description/action/path.
  function handleSearchChange(value: string) {
    handleFilterChange("search", value);
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => {
      setPage(1);
      applyFilters(1, { ...filters, search: value });
    }, 300);
    setSearchTimer(timer);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
    applyFilters(1, EMPTY_FILTERS);
  }

  return (
    <section>
      <h2>Audit Log</h2>
      <p className="review-card__comment">
        Database audit trail of user actions (sign-ups, logins, content
        changes). Click a row for full details.
      </p>

      <form
        onSubmit={submitFilters}
        style={{
          display: "grid",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <fieldset style={{
          border: "1px solid #cfd4da",
          borderRadius: 8,
          padding: "10px 12px",
          marginBottom: 6,
          background: "#f8f9fa",
        }}>
          <legend style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#333",
            padding: "0 6px",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}>
            Filter by
          </legend>
          <div style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label htmlFor="f-user-id" style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>User ID</label>
              <input
                id="f-user-id"
                type="number"
                min="1"
                placeholder="e.g. 42"
                value={filters.user_id}
                onChange={(e) => handleFilterChange("user_id", e.target.value)}
                style={{
                  padding: "5px 8px",
                  border: "1px solid #b7c0c9",
                  borderRadius: 5,
                  fontSize: 13,
                  background: "#fff",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Action</label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange("action", e.target.value)}
                style={{
                  padding: "5px 8px",
                  border: "1px solid #b7c0c9",
                  borderRadius: 5,
                  fontSize: 13,
                  background: "#fff",
                  boxSizing: "border-box",
                  cursor: "pointer",
                }}
              >
                <option value="">All</option>
                {AUDIT_ACTION_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Object type</label>
              <select
                value={filters.object_type}
                onChange={(e) => handleFilterChange("object_type", e.target.value)}
                style={{
                  padding: "5px 8px",
                  border: "1px solid #b7c0c9",
                  borderRadius: 5,
                  fontSize: 13,
                  background: "#fff",
                  boxSizing: "border-box",
                  cursor: "pointer",
                }}
              >
                <option value="">All</option>
                {AUDIT_OBJECT_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label htmlFor="f-object-id" style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Object ID</label>
              <input
                id="f-object-id"
                type="number"
                min="1"
                placeholder="e.g. 7"
                value={filters.object_id}
                onChange={(e) => handleFilterChange("object_id", e.target.value)}
                style={{
                  padding: "5px 8px",
                  border: "1px solid #b7c0c9",
                  borderRadius: 5,
                  fontSize: 13,
                  background: "#fff",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        </fieldset>
        <fieldset style={{
          border: "1px solid #cfd4da",
          borderRadius: 8,
          padding: "10px 12px",
          marginBottom: 6,
          background: "#f8f9fa",
        }}>
          <legend style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#333",
            padding: "0 6px",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}>
            Date range
          </legend>
          <div style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#555", whiteSpace: "nowrap" }}>From</label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => handleFilterChange("date_from", e.target.value)}
                style={{
                  padding: "5px 8px",
                  border: "1px solid #b7c0c9",
                  borderRadius: 5,
                  fontSize: 13,
                  background: "#fff",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#555", whiteSpace: "nowrap" }}>To</label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => handleFilterChange("date_to", e.target.value)}
                style={{
                  padding: "5px 8px",
                  border: "1px solid #b7c0c9",
                  borderRadius: 5,
                  fontSize: 13,
                  background: "#fff",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label htmlFor="f-request-id" style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Request ID</label>
              <input
                id="f-request-id"
                type="text"
                placeholder="req-123"
                value={filters.request_id}
                onChange={(e) => handleFilterChange("request_id", e.target.value)}
                style={{
                  padding: "5px 8px",
                  border: "1px solid #b7c0c9",
                  borderRadius: 5,
                  fontSize: 13,
                  background: "#fff",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        </fieldset>

        <div style={{ marginBottom: 6 }}>
          <label htmlFor="f-search" style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#333",
            marginBottom: 4,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            display: "block",
          }}>
            Search description, action &amp; path
          </label>
          <input
            id="f-search"
            type="search"
            placeholder="e.g. grange, update, /api/v1/wines …"
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 10px",
              border: "1px solid #b7c0c9",
              borderRadius: 6,
              fontSize: 14,
              boxSizing: "border-box",
              background: "#fff",
            }}
          />
        </div>

        <div style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label htmlFor="f-per-page" style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Per page</label>
            <select
              id="f-per-page"
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              style={{
                padding: "5px 8px",
                border: "1px solid #b7c0c9",
                borderRadius: 5,
                fontSize: 13,
                background: "#fff",
                boxSizing: "border-box",
                cursor: "pointer",
              }}
            >
              {PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select
          >
          </div>
          <button
            type="submit"
            className="auth-form__submit"
            disabled={loading}
            style={{
              padding: "6px 16px",
              fontSize: 13,
              borderRadius: 5,
              background: loading ? "#9aa3ad" : "#1e3a8a",
              border: "none",
              color: "#fff",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Applying…" : "Apply filters"}
          </button>
          <button
            type="button"
            onClick={resetFilters}
            style={{
              padding: "6px 16px",
              fontSize: 13,
              borderRadius: 5,
              border: "1px solid #b7c0c9",
              background: "#fff",
              color: "#333",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>
      </form>

      {error && <p className="review-form__error">{error}</p>}
      {loading && <p className="wine-management__loading">Loading…</p>}

      <table className="grapes-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>User</th>
            <th>Action</th>
            <th>Description</th>
            <th>Object</th>
            <th>Method</th>
            <th>Path</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              style={{ cursor: "pointer" }}
              onClick={() => navigate(`/admin/logs/${entry.id}`)}
            >
              <td>{formatDateTime(entry.created_at)}</td>
              <td>{entry.user ? entry.user.display_name : "—"}</td>
              <td>{entry.action}</td>
              <td>{entry.description}</td>
              <td>{objectsSummary(entry)}</td>
              <td>{entry.method || "—"}</td>
              <td>{entry.path || "—"}</td>
            </tr>
          ))}
          {!loading && entries.length === 0 && (
            <tr>
              <td colSpan={7}>No audit log entries found.</td>
            </tr>
          )}
        </tbody>
      </table>

      {pagination && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalCount={pagination.totalCount}
          onPageChange={setPage}
        />
      )}
    </section>
  );
}

// Logs page: tabbed viewer. Default tab is the database audit trail; the
// legacy raw Rails log file viewer stays available. Admin-only.
function Logs() {
  const { user } = useAuth();
  const isAdminUser = isAdmin(user);
  const [tab, setTab] = useState("audit");

  if (!isAdminUser) {
    return (
      <main className="wine-management">
        <div className="wine-management__container">
          <h1>Logs</h1>
          <p className="wine-management__hint">
            Access denied. Admin role required.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="wine-management">
      <div className="wine-management__container">
        <h1>Logs</h1>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            className="auth-form__submit"
            onClick={() => setTab("audit")}
            disabled={tab === "audit"}
          >
            Audit Log (database)
          </button>
          <button
            type="button"
            className="auth-form__submit"
            onClick={() => setTab("file")}
            disabled={tab === "file"}
          >
            Application Log (file)
          </button>
        </div>

        {tab === "audit" ? <AuditLogTable /> : <LogFileViewer />}
      </div>
    </main>
  );
}

export default Logs;
