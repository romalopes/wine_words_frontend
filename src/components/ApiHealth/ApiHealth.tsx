import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styles from "./ApiHealth.module.css";
import {
  API_CHECKS,
  isWriteCheck,
} from "../../services/apiHealth/apiHealthConfig";
import type { ApiCheck } from "../../services/apiHealth/apiHealthConfig";
import {
  runCheck,
  runWriteFlow,
  type HealthCheckResult,
} from "../../services/apiHealth/healthRunner";
import { useAuth } from "../../contexts/AuthContext";
import { getAuthToken } from "../../services/api";
import { isAdmin } from "../../constants/roles";
import { APP_VERSION } from "../../constants/versions";
import ResponseInspector from "./components/ResponseInspector";
import WriteSandbox from "./components/WriteSandbox";
import EmailSendSandbox from "./components/EmailSendSandbox";
import type { DetailedHealthPayload } from "../../types/health";
import DetailHero from "../DetailHero";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

const methodClass: Record<HttpMethod, string | undefined> = {
  GET: styles.get,
  POST: styles.post,
  PATCH: styles.patch,
  DELETE: styles.delete,
};

type LatencyRating = HealthCheckResult["latencyRating"];

function latencyClass(rating: LatencyRating | undefined): string | undefined {
  if (rating === "excellent") return styles.pass;
  if (rating === "good") return styles.neutral;
  return styles.fail;
}

interface StatusBadgeProps {
  passed: boolean | null | undefined;
}

function StatusBadge({ passed }: StatusBadgeProps) {
  const cls =
    passed == null ? styles.neutral : passed ? styles.pass : styles.fail;
  const label = passed == null ? "—" : passed ? "PASS" : "FAIL";
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

interface HistoryEntry {
  at: string;
  passed: number;
  failed: number;
  avgLatency: number;
}

// Renders a 2-column definition list (key/value pairs) for the new
// infrastructure sections in /api/v1/health/detailed. Values that are
// null/undefined render as "—" so the layout stays consistent.
type InfoValue = string | number | boolean | null | undefined;

interface InfoGridProps {
  entries: Array<[string, InfoValue]>;
}

function InfoGrid({ entries }: InfoGridProps) {
  return (
    <dl className={styles.infoGrid}>
      {entries.map(([key, value]) => (
        <div key={key} className={styles.infoRow}>
          <dt className={styles.infoKey}>{key}</dt>
          <dd className={styles.infoValue}>
            {value === null || value === undefined || value === ""
              ? "—"
              : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface InfrastructurePanelProps {
  detailed: HealthCheckResult | null | undefined;
}

function InfrastructurePanel({ detailed }: InfrastructurePanelProps) {
  const payload = detailed?.payload as DetailedHealthPayload | null | undefined;
  if (!payload) return null;

  // Some sections are always present (server/endpoint), others depend on
  // whether the database connection is alive. Only render the
  // "Database connection" section when we have any data to show, so a
  // half-broken DB still leaves the other two sections visible.
  const db = payload.database_details;
  const hasDbData =
    db && Object.values(db).some((v) => v !== null && v !== undefined);

  return (
    <div className={styles.infraPanel}>
      <h2 className={styles.infraTitle}>Infrastructure</h2>
      <p className={styles.infraSubtitle}>
        From <code>GET /api/v1/health/detailed</code>
        {payload.environment && (
          <>
            {" · environment: "}
            <code>{payload.environment}</code>
          </>
        )}
      </p>

      {hasDbData && (
        <section className={styles.infraSection}>
          <h3 className={styles.infraSectionTitle}>Database connection</h3>
          <InfoGrid
            entries={[
              ["Adapter", db.adapter],
              ["Database", db.database],
              ["Host", db.host],
              ["Port", db.port],
              ["Username", db.username],
              ["Encoding", db.encoding],
              ["Pool size", db.pool],
              ["Checkout timeout (s)", db.checkout_timeout],
              ["Reaping frequency (s)", db.reaping_frequency],
              ["Idle timeout (s)", db.idle_timeout],
            ]}
          />
        </section>
      )}

      {payload.server && (
        <section className={styles.infraSection}>
          <h3 className={styles.infraSectionTitle}>Server</h3>
          <InfoGrid
            entries={[
              ["Rails version", payload.server.rails_version],
              ["Ruby", payload.server.ruby],
              ["Puma workers", payload.server.puma_workers],
              ["Hostname", payload.server.hostname],
              ["PID", payload.server.pid],
              ["Hosted on Render", payload.server.render ? "yes" : "no"],
            ]}
          />
        </section>
      )}

      {payload.endpoint && (
        <section className={styles.infraSection}>
          <h3 className={styles.infraSectionTitle}>Request endpoint</h3>
          <InfoGrid
            entries={[
              ["Scheme", payload.endpoint.scheme],
              ["Host", payload.endpoint.host],
              ["Port", payload.endpoint.port],
              ["Base URL", payload.endpoint.base_url],
              ["Path", payload.endpoint.path],
            ]}
          />
        </section>
      )}

      {payload.storage_details && (
        <section className={styles.infraSection}>
          <h3 className={styles.infraSectionTitle}>File storage</h3>
          <InfoGrid
            entries={[
              ["Service", payload.storage_details.service],
              ["Service class", payload.storage_details.service_class],
              ["Bucket", payload.storage_details.bucket],
              ["Region", payload.storage_details.region],
              ["Endpoint", payload.storage_details.endpoint],
              ["Disk root", payload.storage_details.root],
              [
                "Public",
                payload.storage_details.public == null
                  ? null
                  : payload.storage_details.public
                    ? "yes"
                    : "no",
              ],
            ]}
          />
        </section>
      )}
    </div>
  );
}

export default function ApiHealth() {
  const { user } = useAuth();
  const isAdminUser = isAdmin(user);

  const [results, setResults] = useState<Record<string, HealthCheckResult>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({}); // checkId -> bool
  const [runningAll, setRunningAll] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}); // checkId -> bool

  const regularChecks = useMemo(
    () => API_CHECKS.filter((c) => !isWriteCheck(c)),
    [],
  );
  const writeChecks = useMemo(
    () => API_CHECKS.filter((c) => isWriteCheck(c) && c.id !== "email-send-test"),
    [],
  );
  const emailChecks = useMemo(
    () => API_CHECKS.filter((c) => c.id === "email-send-test" || c.id === "email-transport"),
    [],
  );

  const grouped = useMemo(() => {
    const map: Record<string, ApiCheck[]> = {};
    regularChecks.forEach((check) => {
      const list = map[check.category];
      if (list) list.push(check);
      else map[check.category] = [check];
      return undefined;
    });
    return map;
  }, [regularChecks]);

  if (!isAdminUser) {
    return (
      <main className={styles.container}>
        <p className={styles.statusText}>
          You do not have permission to view API health diagnostics.
        </p>
      </main>
    );
  }

  async function runSingle(check: ApiCheck): Promise<HealthCheckResult> {
    setRunning((prev) => ({ ...prev, [check.id]: true }));
    try {
      const result = await runCheck(check, { getAuthToken });
      setResults((prev) => ({ ...prev, [check.id]: result }));
      return result;
    } finally {
      setRunning((prev) => ({ ...prev, [check.id]: false }));
    }
  }

  async function runAll() {
    setRunningAll(true);
    try {
      const outs = await Promise.all(
        regularChecks.map((c) => runCheck(c, { getAuthToken })),
      );
      setResults((prev) => {
        const next = { ...prev };
        outs.forEach((r: HealthCheckResult) => {
          next[r.id] = r;
        });
        return next;
      });
      const passed = outs.filter((r: HealthCheckResult) => r.passed).length;
      const avgLatency = Math.round(
        outs.reduce((sum: number, r: HealthCheckResult) => sum + (r.latencyMs || 0), 0) /
          Math.max(outs.length, 1),
      );
      setHistory((prev) =>
        [
          {
            at: new Date().toLocaleTimeString(),
            passed,
            failed: outs.length - passed,
            avgLatency,
          },
          ...prev,
        ].slice(0, 5),
      );
    } finally {
      setRunningAll(false);
    }
  }

  async function runWriteSingle(check: ApiCheck): Promise<void> {
    setRunning((prev) => ({ ...prev, [check.id]: true }));
    try {
      const result = await runWriteFlow(check, { getAuthToken });
      setResults((prev) => ({ ...prev, [check.id]: result }));
    } finally {
      setRunning((prev) => ({ ...prev, [check.id]: false }));
    }
  }


  function toggleCategory(name: string): void {
    setOpenCategories((prev) => ({ ...prev, [name]: !prev[name] }));
  }
  function toggleInspector(id: string): void {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const allResults = Object.values(results);
  const totalPassed = allResults.filter((r) => r.passed).length;
  const totalFailed = allResults.filter((r) => !r.passed).length;
  const avgLatency = allResults.length
    ? Math.round(
        allResults.reduce((s, r) => s + (r.latencyMs || 0), 0) /
          allResults.length,
      )
    : 0;

  const detailed = results["system-detailed"];
  const backendVersion =
    typeof (detailed?.payload as Record<string, unknown> | undefined)?.version ===
    "string"
      ? ((detailed?.payload as Record<string, unknown>).version as string)
      : null;
  const versionMatched =
    backendVersion === null ? null : backendVersion === APP_VERSION;
  return (
    <main className={styles.container}>
      <Link to="/" className="wine-detail__back">
        &larr; Back to Dashboard
      </Link>
      <div className={styles.header}>
        <DetailHero
          kicker="Admin"
          title="API Health & Diagnostics"
          intro={
            <>
              {API_CHECKS.length} checks configured · backend{" "}
              <code>{backendVersion ?? "…"}</code> ·{" "}
              {new Date().toLocaleString()}
            </>
          }
          actions={
            <div className={styles.toolbar}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={runAll}
                disabled={runningAll}
              >
                {runningAll && <span className={styles.spinner} />} Run All Checks
              </button>
            </div>
          }
        />
      </div>

      {versionMatched != null && (
        <div
          className={`${styles.versionNotice} ${versionMatched ? styles.versionOk : styles.versionWarn}`}
        >
          {versionMatched
            ? `✓ Version match: backend ${backendVersion}`
            : `⚠ Version mismatch: backend reports ${backendVersion} but frontend expects ${APP_VERSION}`}
        </div>
      )}

      <InfrastructurePanel detailed={detailed} />

      {allResults.length > 0 && (
        <div className={styles.summaryBar}>
          <span className={styles.summaryStat}>
            <span className={styles.summaryLabel}>Passed</span>
            <span
              className={`${styles.summaryValue}`}
              style={{ color: "#137333" }}
            >
              {totalPassed}
            </span>
          </span>
          <span className={styles.summaryStat}>
            <span className={styles.summaryLabel}>Failed</span>
            <span
              className={`${styles.summaryValue}`}
              style={{ color: "#c5221f" }}
            >
              {totalFailed}
            </span>
          </span>
          <span className={styles.summaryStat}>
            <span className={styles.summaryLabel}>Avg Latency</span>
            <span className={`${styles.summaryValue}`}>{avgLatency}ms</span>
          </span>
        </div>
      )}

      {Object.entries(grouped).map(([category, checks]: [string, ApiCheck[]]) => {
        const open = openCategories[category] !== false;
        return (
          <section key={category} className={styles.category}>
            <button
              type="button"
              className={styles.categoryHeader}
              onClick={() => toggleCategory(category)}
            >
              <span>{category}</span>
              <span className={styles.categorySummary}>{open ? "▲" : "▼"}</span>
            </button>
            {open && (
              <div className={styles.categoryBody}>
                {checks.map((check) => {
                  const result = results[check.id];
                  const isRunning = running[check.id];
                  const isExpanded = expanded[check.id];
                  return (
                    <div key={check.id}>
                      <div className={styles.row}>
                        <span
                          className={`${styles.methodPill} ${methodClass[check.method as HttpMethod] ?? ""}`}
                        >
                          {check.method}
                        </span>
                        <div className={styles.rowMeta}>
                          <p className={styles.rowName}>{check.name}</p>
                          <div className={styles.rowUrl}>{check.url}</div>
                        </div>
                        <StatusBadge passed={result?.passed} />
                        {result && (
                          <span className={styles.latency}>
                            <span
                              className={`${styles.badge} ${latencyClass(result.latencyRating)}`}
                            >
                              {result.latencyMs}ms
                            </span>
                            <span style={{ marginLeft: "0.4rem" }}>
                              {result.status}
                            </span>
                          </span>
                        )}
                        <button
                          type="button"
                          className={styles.btn}
                          disabled={isRunning || runningAll}
                          onClick={() => runSingle(check)}
                        >
                          {isRunning ? "Testing…" : "Test"}
                        </button>
                        <button
                          type="button"
                          className={styles.btn}
                          onClick={() => toggleInspector(check.id)}
                        >
                          {isExpanded ? "Hide Details" : "Show Details"}
                        </button>
                      </div>
                      {isExpanded && (
                        <ResponseInspector check={check} result={result} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {writeChecks.map((check) => (
        <WriteSandbox
          key={check.id}
          check={check}
          result={results[check.id]}
          running={running[check.id] === true}
          onRun={() => runWriteSingle(check)}
        />
      ))}

      {emailChecks.map((check) => (
        check.id === "email-send-test" ? (
          <EmailSendSandbox
            key={check.id}
            check={check}
            result={results[check.id] ?? null}
            running={running[check.id] === true}
            transportResult={results["email-transport"] ?? null}
          />
        ) : (
          <div key={check.id}>
            <div className={styles.row}>
              <span className={`${styles.methodPill} ${methodClass[check.method as HttpMethod] ?? ""}`}>
                {check.method}
              </span>
              <div className={styles.rowMeta}>
                <p className={styles.rowName}>{check.name}</p>
                <div className={styles.rowUrl}>{check.url}</div>
              </div>
              <StatusBadge passed={results[check.id]?.passed} />
              {results[check.id] && (
                <span className={styles.latency}>
                  <span
                    className={`${styles.badge} ${latencyClass(results[check.id]?.latencyRating)}`}
                  >
                    {results[check.id]?.latencyMs}ms
                  </span>
                  <span style={{ marginLeft: "0.4rem" }}>{results[check.id]?.status}</span>
                </span>
              )}
              <button
                type="button"
                className={styles.btn}
                disabled={running[check.id] === true || runningAll}
                onClick={() => runSingle(check)}
              >
                {running[check.id] === true ? "Testing…" : "Test"}
              </button>
              <button
                type="button"
                className={styles.btn}
                onClick={() => toggleInspector(check.id)}
              >
                {expanded[check.id] ? "Hide Details" : "Show Details"}
              </button>
            </div>
            {expanded[check.id] && <ResponseInspector check={check} result={results[check.id]} />}
          </div>
        )
      ))}

      {history.length > 0 && (
        <div className={styles.history}>
          <h2 className={styles.historyTitle}>Run History (last 5)</h2>
          {history.map((h, i) => (
            <div key={i} className={styles.historyRow}>
              <span>{h.at}</span>
              <span className={`${styles.badge} ${styles.pass}`}>
                {h.passed} passed
              </span>
              <span className={`${styles.badge} ${styles.fail}`}>
                {h.failed} failed
              </span>
              <span>avg {h.avgLatency}ms</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
