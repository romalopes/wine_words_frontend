import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { isAdmin } from "../constants/roles";
import { configurationApi, settingsApi } from "../services/api";
import type { ConfigurationUpdatePayload } from "../types/api";
import type { Setting } from "../types/notification";
import { errorMessage } from "../utils/errors";
import DetailHero from "./DetailHero";

// New (unsaved) custom settings carry a client-generated temp id like
// "new-<timestamp>-<random>"; server rows have numeric ids.
function isTempId(id: Setting["id"]): boolean {
  return typeof id === "string" && id.startsWith("new-");
}

function Configuration() {
  const { user } = useAuth();
  const isAdminUser = isAdmin(user);

  const [logsSaved, setLogsSaved] = useState(true);
  const [savedLogsSaved, setSavedLogsSaved] = useState(true);
  const [useTestEmail, setUseTestEmail] = useState(false);
  const [savedUseTestEmail, setSavedUseTestEmail] = useState(false);
  const [testEmail, setTestEmail] = useState("romalopes@yahoo.com.br");
  const [savedTestEmail, setSavedTestEmail] = useState(
    "romalopes@yahoo.com.br",
  );
  const [mailTransport, setMailTransport] = useState("auto");
  const [savedMailTransport, setSavedMailTransport] = useState("auto");

  const [customSettings, setCustomSettings] = useState<Setting[]>([]);
  const [savedCustomSettings, setSavedCustomSettings] = useState<Setting[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editingId, setEditingId] = useState<Setting["id"] | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!isAdminUser) return;
    let cancelled = false;
    configurationApi
      .fetch()
      .then((data) => {
        if (cancelled) return;
        setLogsSaved(data?.logs_saved_to_database !== false);
        setSavedLogsSaved(data?.logs_saved_to_database !== false);
        setUseTestEmail(data?.use_test_email === true);
        setSavedUseTestEmail(data?.use_test_email === true);
        setTestEmail(data?.test_email || "romalopes@yahoo.com.br");
        setSavedTestEmail(data?.test_email || "romalopes@yahoo.com.br");
        setMailTransport(data?.mail_transport || "auto");
        setSavedMailTransport(data?.mail_transport || "auto");
        const settings = Array.isArray(data?.settings) ? data.settings : [];
        setCustomSettings(settings);
        setSavedCustomSettings(settings);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err.message || "Failed to load configuration.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdminUser]);

  if (!isAdminUser) {
    return (
      <main className="wine-management">
        <div className="wine-management__container">
          <DetailHero kicker="Admin" title="Configuration" intro="Access denied. Admin role required." />
        </div>
      </main>
    );
  }

  const logsDirty = logsSaved !== savedLogsSaved;
  const emailDirty =
    useTestEmail !== savedUseTestEmail || testEmail !== savedTestEmail;
  const mailTransportDirty = mailTransport !== savedMailTransport;
  const customDirty =
    JSON.stringify(customSettings) !== JSON.stringify(savedCustomSettings);
  const dirty =
    logsDirty || emailDirty || mailTransportDirty || customDirty;

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: ConfigurationUpdatePayload = {};
      if (logsDirty) payload.logs_saved_to_database = logsSaved;
      if (emailDirty) {
        payload.use_test_email = useTestEmail;
        payload.test_email = testEmail;
      }
      if (mailTransportDirty) payload.mail_transport = mailTransport;
      if (customDirty) {
        // `savedCustomSettings` is the snapshot from the last successful load:
        // every row in it is either updated to the current value or, when the
        // row no longer exists locally, destroyed on the server.
        const currentMap = new Map(customSettings.map((s) => [s.id, s]));
        for (const saved of savedCustomSettings) {
          const current = currentMap.get(saved.id);
          if (current) {
            if (current.value !== saved.value) {
              await settingsApi.update(saved.id, { value: current.value });
            }
          } else {
            await settingsApi.destroy(saved.id);
          }
        }
        for (const current of customSettings) {
          if (isTempId(current.id)) {
            const created = await settingsApi.create({
              key: current.key,
              value: current.value,
            });
            setCustomSettings((prev) =>
              prev.map((s) => (s.id === current.id ? created : s)),
            );
          }
        }
      }
      const data = await configurationApi.update(payload);
      setLogsSaved(data?.logs_saved_to_database !== false);
      setSavedLogsSaved(data?.logs_saved_to_database !== false);
      setUseTestEmail(data?.use_test_email === true);
      setSavedUseTestEmail(data?.use_test_email === true);
      setTestEmail(data?.test_email || "romalopes@yahoo.com.br");
      setSavedTestEmail(data?.test_email || "romalopes@yahoo.com.br");
      setMailTransport(data?.mail_transport || "auto");
      setSavedMailTransport(data?.mail_transport || "auto");
      const settings = Array.isArray(data?.settings) ? data.settings : [];
      setCustomSettings(settings);
      setSavedCustomSettings(settings);
      setSavedAt(new Date());
    } catch (err) {
      setError(errorMessage(err, "Failed to save configuration."));
    } finally {
      setSaving(false);
    }
  }

  function addCustomSetting() {
    const key = newKey.trim();
    if (!key) return;
    const tempId =
      "new-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    setCustomSettings((prev) => [
      ...prev,
      { id: tempId, key, value: newValue.trim() },
    ]);
    setNewKey("");
    setNewValue("");
  }

  function deleteCustomSetting(id: Setting["id"]) {
    setCustomSettings((prev) => prev.filter((s) => s.id !== id));
  }

  function startEdit(setting: Setting) {
    setEditingId(setting.id);
    setEditingValue(String(setting.value ?? ""));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingValue("");
  }

  function commitEdit(id: Setting["id"], newValue: string) {
    setCustomSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, value: newValue } : s)),
    );
    setEditingId(null);
    setEditingValue("");
  }

  return (
    <main className="wine-management">
      <div className="wine-management__container">
        <Link to="/" className="wine-detail__back">
          &larr; Back to Dashboard
        </Link>
        <DetailHero
          kicker="Admin"
          title="Configuration"
          intro="Global application settings. Changes take effect immediately."
        />

        {loading ? (
          <p className="wine-management__hint">Loading configuration...</p>
        ) : (
          <form onSubmit={handleSave}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  border: "1px solid #ccc",
                  borderRadius: 6,
                  padding: 16,
                  background: "#fafafa",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#333",
                    marginBottom: 10,
                  }}
                >
                  Logs
                </h2>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={logsSaved}
                    onChange={(e) => setLogsSaved(e.target.checked)}
                    disabled={saving}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 14 }}>Save logs to database</span>
                </label>
                <p
                  style={{
                    fontSize: 12,
                    color: "#666",
                    margin: "8px 0 0 0",
                    lineHeight: 1.4,
                  }}
                >
                  When enabled (default), audited actions are persisted to the
                  database audit trail. When disabled, no new log entries are
                  written.
                </p>
              </div>
              <div
                style={{
                  border: "1px solid #ccc",
                  borderRadius: 6,
                  padding: 16,
                  background: "#fafafa",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#333",
                    marginBottom: 10,
                  }}
                >
                  Email testing
                </h2>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    marginBottom: 10,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={useTestEmail}
                    onChange={(e) => setUseTestEmail(e.target.checked)}
                    disabled={saving}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 14 }}>
                    Use test email for all mail
                  </span>
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: "#555",
                      flexGrow: 1,
                      flexShrink: 1,
                      flexBasis: "0%",
                    }}
                  >
                    Test email address
                  </span>
                  <input
                    type="text"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    disabled={saving || !useTestEmail}
                    placeholder="romalopes@yahoo.com.br"
                    style={{
                      width: 240,
                      padding: "3px 6px",
                      fontSize: 13,
                      border: "1px solid #ccc",
                      borderRadius: 3,
                      background: useTestEmail ? "#fff" : "#f5f5f5",
                    }}
                  />
                </label>
                <p
                  style={{
                    fontSize: 11,
                    color: "#888",
                    margin: "6px 0 0 0",
                    lineHeight: 1.4,
                  }}
                >
                  When enabled, all outgoing mail is redirected to this address
                  with a [TEST] subject prefix.
                </p>
              </div>
              <div
                style={{
                  border: "1px solid #ccc",
                  borderRadius: 6,
                  padding: 16,
                  background: "#fafafa",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#333",
                    marginBottom: 10,
                  }}
                >
                  Mail transport
                </h2>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: "#555",
                      flexGrow: 1,
                      flexShrink: 1,
                      flexBasis: "0%",
                    }}
                  >
                    Delivery method
                  </span>
                  <select
                    value={mailTransport}
                    onChange={(e) => setMailTransport(e.target.value)}
                    disabled={saving}
                    style={{
                      width: 260,
                      padding: "3px 6px",
                      fontSize: 13,
                      border: "1px solid #ccc",
                      borderRadius: 3,
                      background: "#fff",
                    }}
                  >
                    <option value="auto">
                      Auto (Brevo → Resend → SMTP → File)
                    </option>
                    <option value="brevo">Brevo</option>
                    <option value="resend">Resend</option>
                    <option value="smtp">SMTP</option>
                    <option value="file">File</option>
                  </select>
                </label>
                <p
                  style={{
                    fontSize: 11,
                    color: "#888",
                    margin: "6px 0 0 0",
                    lineHeight: 1.4,
                  }}
                >
                  Chooses the ActionMailer delivery method. "auto" selects the
                  first available of Brevo, Resend, SMTP, or File.
                </p>
              </div>
            </div>
            <div
              style={{
                border: "1px solid #ccc",
                borderRadius: 6,
                overflow: "hidden",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  padding: "10px 14px",
                  background: "#f5f5f5",
                  borderBottom: "1px solid #ccc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#333",
                  }}
                >
                  Custom settings
                </h2>
                <span style={{ fontSize: 11, color: "#888" }}>
                  Arbitrary key/value pairs readable via AppSetting at runtime.
                </span>
              </div>
              <div style={{ padding: "0 14px 10px 14px" }}>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <input
                    type="text"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    disabled={saving}
                    placeholder="Key"
                    style={{
                      flexGrow: 0,
                      flexShrink: 0,
                      flexBasis: "140px",
                      padding: "4px 6px",
                      fontSize: 13,
                      border: "1px solid #ccc",
                      borderRadius: 3,
                    }}
                  />
                  <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    disabled={saving}
                    placeholder="Value"
                    style={{
                      flexGrow: 1,
                      flexShrink: 1,
                      flexBasis: "0%",
                      padding: "4px 6px",
                      fontSize: 13,
                      border: "1px solid #ccc",
                      borderRadius: 3,
                    }}
                  />
                  <button
                    type="button"
                    onClick={addCustomSetting}
                    disabled={saving || !newKey.trim()}
                    style={{
                      padding: "4px 10px",
                      fontSize: 12,
                      background: "#1a73e8",
                      color: "#fff",
                      border: "none",
                      borderRadius: 3,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
              {customSettings.length > 0 && (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#fafafa" }}>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "6px 10px",
                          borderBottom: "1px solid #eee",
                          color: "#555",
                          fontWeight: 500,
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                        }}
                      >
                        Key
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "6px 10px",
                          borderBottom: "1px solid #eee",
                          color: "#555",
                          fontWeight: 500,
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                        }}
                      >
                        Value
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "6px 10px",
                          borderBottom: "1px solid #eee",
                          color: "#555",
                          fontWeight: 500,
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                          width: 50,
                        }}
                      ></th>
                    </tr>
                  </thead>
                  <tbody>
                    {customSettings.map((setting, idx) => (
                      <tr
                        key={setting.id || idx}
                        style={{
                          background: idx % 2 === 0 ? "#fff" : "#fafafa",
                        }}
                      >
                        <td style={{ padding: "5px 10px", fontWeight: 500 }}>
                          {setting.key}
                        </td>
                        <td style={{ padding: "5px 10px" }}>
                          {editingId === setting.id ? (
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() =>
                                commitEdit(setting.id, editingValue)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  commitEdit(setting.id, editingValue);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              autoFocus
                              style={{
                                width: "100%",
                                padding: "2px 4px",
                                fontSize: 13,
                                border: "1px solid #1a73e8",
                                borderRadius: 2,
                                boxSizing: "border-box",
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                cursor: "pointer",
                                color: "#1a73e8",
                                padding: "2px 4px",
                                borderRadius: 2,
                              }}
                              onMouseOver={(e) =>
                                (e.currentTarget.style.background = "#e8f0fe")
                              }
                              onMouseOut={(e) =>
                                (e.currentTarget.style.background = "")
                              }
                              onClick={() => startEdit(setting)}
                              title="Click to edit"
                            >
                              {String(setting.value ?? "")}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "5px 10px", textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => deleteCustomSetting(setting.id)}
                            disabled={saving}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#c62828",
                              cursor: "pointer",
                              fontSize: 14,
                              padding: 0,
                              lineHeight: 1,
                            }}
                            title="Delete setting"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {customSettings.length === 0 && (
                <div
                  style={{
                    padding: "14px",
                    textAlign: "center",
                    color: "#999",
                    fontSize: 13,
                  }}
                >
                  No custom settings. Add one above.
                </div>
              )}
            </div>
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <button
                type="submit"
                className="auth-form__submit"
                disabled={saving || !dirty}
                style={{ padding: "6px 18px", fontSize: 13 }}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
              {savedAt && !error && (
                <span style={{ fontSize: 12, color: "#666" }}>
                  Saved at {savedAt.toLocaleTimeString()}
                </span>
              )}
              {error && (
                <span style={{ fontSize: 12, color: "#c62828" }} role="alert">
                  {error}
                </span>
              )}
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

export default Configuration;
