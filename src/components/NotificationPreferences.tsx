import { useEffect, useState } from "react";
import { followsApi } from "../services/api";
import type { NotificationPreferences as PreferencePayload } from "../services/followsApi";

/**
 * Follow-notification preferences (issue #192 phase 8): in-app on/off,
 * immediate email on/off and the digest cadence. Loaded from and saved to
 * `GET|PATCH /api/v1/account/notification_preferences`.
 */
export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<PreferencePayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    followsApi
      .preferences()
      .then((data) => {
        if (!cancelled) setPrefs(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load preferences");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (patch: Partial<PreferencePayload>) => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const data = await followsApi.updatePreferences(patch);
      setPrefs(data);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (!prefs && !error) {
    return <p className="following-page__status">Loading preferences…</p>;
  }

  return (
    <section className="following-page__prefs" aria-label="Notification preferences">
      <h2>Notification preferences</h2>
      {error && (
        <p role="alert" className="following-page__status">
          {error}
        </p>
      )}
      {prefs && (
        <>
          <label className="following-page__pref-row">
            <input
              type="checkbox"
              checked={prefs.follow_in_app}
              disabled={saving}
              onChange={(e) => void save({ follow_in_app: e.target.checked })}
            />
            Show follow updates in my notifications feed
          </label>
          <label className="following-page__pref-row">
            <input
              type="checkbox"
              checked={prefs.follow_email}
              disabled={saving}
              onChange={(e) => void save({ follow_email: e.target.checked })}
            />
            Email me about every follow update
          </label>
          <label className="following-page__pref-row">
            <span>Email digest</span>
            <select
              value={prefs.digest_cadence}
              disabled={saving}
              onChange={(e) =>
                void save({ digest_cadence: e.target.value as PreferencePayload["digest_cadence"] })
              }
            >
              <option value="none">No digest</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          {saved && (
            <p className="following-page__status" role="status">
              Preferences saved.
            </p>
          )}
        </>
      )}
    </section>
  );
}