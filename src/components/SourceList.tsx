import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Button, Card, Chip, Spinner } from "@heroui/react";
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
    <main className="wine-app hero-settings-page">
      <PageHero
        kicker="Settings"
        title="Sources"
        description="See where editorial content originated and explore every review and article attributed to each source."
      />

      <section className="hero-settings-section" aria-label="Sources" aria-busy={loading}>
        {loading ? (
          <div className="hero-settings-state" role="status">
            <Spinner color="accent" size="lg" />
            <span>Loading sources…</span>
          </div>
        ) : error ? (
          <Alert status="danger" className="hero-settings-alert">
            <Alert.Content>
              <Alert.Title>Unable to load sources</Alert.Title>
              <Alert.Description>{error}</Alert.Description>
            </Alert.Content>
            <Button variant="outline" onPress={() => window.location.reload()}>
              Retry
            </Button>
          </Alert>
        ) : sources.length === 0 ? (
          <Card variant="secondary" className="hero-settings-empty">
            <Card.Content>
              <Card.Title>No sources found</Card.Title>
              <Card.Description>Sources will appear here when content is attributed to them.</Card.Description>
            </Card.Content>
          </Card>
        ) : (
          <div className="source-library-grid">
            {sources.map((source) => (
              <Card
                key={source.source}
                className="source-library-card"
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
                <Card.Header>
                  <div className="source-library-card__heading">
                    <span className="source-library-card__eyebrow">Content source</span>
                    <Card.Title>{source.label}</Card.Title>
                  </div>
                  <span className="source-library-card__arrow" aria-hidden="true">→</span>
                </Card.Header>
                <Card.Content>
                  <Card.Description>
                    Browse all published content attributed to {source.label}.
                  </Card.Description>
                </Card.Content>
                <Card.Footer className="source-library-card__counts">
                  <Chip color="accent" variant="soft">
                    {source.reviews_count} {source.reviews_count === 1 ? "review" : "reviews"}
                  </Chip>
                  <Chip color="default" variant="soft">
                    {source.articles_count} {source.articles_count === 1 ? "article" : "articles"}
                  </Chip>
                </Card.Footer>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default SourceList;
