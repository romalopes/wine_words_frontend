import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHero from "./PageHero";
import { sourcesApi } from "../services/api";
import { errorMessage } from "../utils/errors";
import { useAuth } from "../contexts/AuthContext";
import { canManageWinesRole } from "../constants/roles";
import type { Source } from "../types/api";

/**
 * Settings page: the list of content sources (Manual / Substack / WineFront)
 * with the number of reviews and articles per source. Each row links to a
 * source page that lists that source's reviews and articles, so the layout
 * mirrors the other management listings (Producers, Categories, …).
 */
function SourceList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = canManageWinesRole(user);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const data = await sourcesApi.list();
        if (!cancelled) {
          setSources(data?.sources ?? []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, "Failed to load sources"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!canManage) {
    return (
      <main className="wine-app">
        <p className="wine-management__error">
          You do not have permission to view this page.
        </p>
        <Link to="/" className="auth-form__submit">
          Back Home
        </Link>
      </main>
    );
  }

  return (
    <div className="wine-app">
      <PageHero
        kicker="Settings"
        title="Sources"
        description="Content sources used to attribute reviews and articles."
      />

      <section aria-label="Sources" aria-busy={loading}>
        {loading ? (
          <p className="wine-management__loading" role="status">
            Loading sources…
          </p>
        ) : error ? (
          <div role="alert">
            <p className="wine-management__error">{error}</p>
            <button className="auth-form__submit" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        ) : sources.length === 0 ? (
          <div className="wine-management__empty">
            <p>No sources found.</p>
          </div>
        ) : (
          <div className="wine-management__grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {sources.map((source) => (
              <div
                key={source.source}
                className="wine-management__card"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/sources/${source.source}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/sources/${source.source}`);
                  }
                }}
              >
                <div className="wine-management__card-header">
                  <h3>{source.label}</h3>
                </div>
                <p className="wine-management__region">
                  {source.reviews_count} {source.reviews_count === 1 ? "review" : "reviews"}
                </p>
                <p className="wine-management__vintage-count">
                  {source.articles_count} {source.articles_count === 1 ? "article" : "articles"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default SourceList;
