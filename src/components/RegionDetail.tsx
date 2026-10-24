import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DetailHero from "./DetailHero";
import { regionsApi, winesApi, producersApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { isAdmin, canManageGrapes, canManageWinesRole } from "../constants/roles";
import WineTable from "./WineTable";
import ProducerTable from "./ProducerTable";
import Pagination from "./Pagination";
import usePagedList from "../hooks/usePagedList";
import BackToSource from "./BackToSource";
import { useReturnToLink } from "../hooks/useReturnToLink";
import { errorMessage } from "../utils/errors";
import type {
  RegionDetail as RegionDetailData,
  RegionPathCrumb,
} from "../types/reference";
import type { WineListItem } from "../types/wine";

function typeLabel(region: RegionDetailData): string {
  const labels: string[] = [];
  if (region.is_state) labels.push("State");
  if (region.is_appellation) labels.push("Appellation");
  return labels.length > 0 ? labels.join(" / ") : "Region";
}

function RegionDetail() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const returnToLink = useReturnToLink();
  const canManage = isAdmin(user) || canManageGrapes(user);
  // Admins, Reviewers and Editors may link wines to this region.
  const canManageWines = canManageWinesRole(user);
  const [region, setRegion] = useState<RegionDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Paginated per-region lists (independent URL params so paging one
  // section does not disturb the other).
  const producers = usePagedList({
    fetcher: (params) => producersApi.list({ ...params, region_id: region?.id }),
    enabled: Boolean(region?.id),
    paramKey: "producer_page",
  });
  const wines = usePagedList({
    fetcher: (params) => winesApi.list({ ...params, region_id: region?.id }),
    enabled: Boolean(region?.id),
    paramKey: "page",
  });

  // Inline wine search for linking wines to this region.
  const [wineQuery, setWineQuery] = useState("");
  const [wineResults, setWineResults] = useState<WineListItem[] | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const loadRegion = useCallback(async () => {
    try {
      setError(null);
      const data = await regionsApi.show(slug);
      setRegion(data);
    } catch (err) {
      setError(errorMessage(err, "Failed to load region"));
      throw err;
    }
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadRegion()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadRegion]);

  // Debounced wine search for the linking UI.
  useEffect(() => {
    if (!canManageWines) return undefined;
    const query = wineQuery.trim();
    if (query.length < 2) {
      setWineResults(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await winesApi.search(query);
        if (!cancelled) setWineResults(results.slice(0, 8));
      } catch {
        if (!cancelled) setWineResults([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wineQuery, canManageWines]);

  async function handleLinkWine(wine: WineListItem) {
    if (!region) return;
    const current = wine.regions?.some(
      (r) => String(r.id) === String(region.id),
    );
    if (current) return;
    if (!window.confirm(`Add "${wine.name}" to "${region.name}"?`)) return;
    setLinking(true);
    setLinkError(null);
    try {
      await regionsApi.linkWine(region.slug, wine.slug);
      await loadRegion();
      wines.reload();
    } catch (err) {
      setLinkError(errorMessage(err, "Failed to link wine"));
    } finally {
      setLinking(false);
    }
  }

  if (loading) {
    return (
      <div className="grapes-page">
        <p className="grapes-page__loading">Loading region…</p>
      </div>
    );
  }

  if (error || !region) {
    return (
      <div className="grapes-page">
        {error && <div className="flash flash--alert">{error}</div>}
        <BackToSource />
        <Link to="/regions" className="back-link">
          &larr; Back to regions
        </Link>
      </div>
    );
  }

  // Get the full path from country to region. `full_path` is always present
  // from the API; this fallback covers a payload that omits it. A country
  // crumb needs a slug to link to, so it is only included when the region
  // actually has a country (previously this read `region.country.slug` and
  // would throw for a country-less region).
  const path: RegionPathCrumb[] = region.full_path ?? [
    ...(region.country
      ? [
          {
            type: "country" as const,
            id: region.country.id,
            slug: region.country.slug,
            name: region.country.name,
            flag_emoji: region.country.flag_emoji,
          },
        ]
      : []),
    {
      type: "region" as const,
      id: region.id,
      slug: region.slug,
      name: region.name,
    },
  ];

  return (
    <div className="grapes-page">
      <DetailHero
        kicker="Region"
        title={`${region.country?.flag_emoji ? `${region.country.flag_emoji} ` : ""}${region.name}`}
      >
        {canManage && (
          <Link to="/regions" className="btn-primary">
            Manage Regions
          </Link>
        )}
      </DetailHero>

      {/* Region Path/Breadcrumb */}
      <div className="region-detail__path">
        {path.map((item, index) => (
          <span key={index} className="region-detail__path-item">
            {index > 0 && " → "}
            {item.type === "country" && item.flag_emoji && (
              <span className="region-detail__flag">{item.flag_emoji} </span>
            )}
            <Link
              to={returnToLink(
                item.type === "country"
                  ? `/countries/${item.slug}`
                  : `/regions/${item.slug}`,
              )}
              className="region-detail__path-link"
            >
              {item.name}
            </Link>
          </span>
        ))}
      </div>

      <div className="region-detail__section">
        <h2>Details</h2>
        <ul className="facts">
          <li>
            <strong>Country:</strong>{" "}
            {region.country?.flag_emoji ? `${region.country.flag_emoji} ` : ""}
            {region.country?.name || "—"}
          </li>
          <li>
            <strong>Type:</strong> {typeLabel(region)}
          </li>
          <li>
            <strong>Parent:</strong> {region.parent_name ? `Yes (${region.parent_name})` : "—"}
          </li>
        </ul>
      </div>

      {canManageWines && (
        <div className="region-detail__section">
          <h2>Link a Wine</h2>
          <div className="review-form__field">
            <label htmlFor="region-wine-search">
              Search wines by name to add them to {region.name}
            </label>
            <input
              id="region-wine-search"
              type="text"
              value={wineQuery}
              onChange={(e) => setWineQuery(e.target.value)}
              placeholder="Search wines by name…"
            />
          </div>
          {linkError && <p className="review-form__error">{linkError}</p>}
          {wineResults != null &&
            (wineResults.length === 0 ? (
              <p className="wine-management__empty-state">No matching wines.</p>
            ) : (
              <ul
                className="wine-list"
                style={{ display: "grid", gap: 6, listStyle: "none", padding: 0 }}
              >
                {wineResults.map((wine) => {
                  const linkedHere = wine.regions?.some(
                    (r) => String(r.id) === String(region.id),
                  );
                  return (
                    <li
                      key={wine.slug}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        border: "1px solid #d8c8c0",
                        borderRadius: 8,
                        padding: "8px 12px",
                        background: "#fff",
                      }}
                    >
                      <strong>{wine.name}</strong>
                      {linkedHere ? (
                        <span style={{ color: "#2e7d43", fontWeight: 700 }}>
                          Linked here ✓
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="review-form__status-btn"
                          disabled={linking}
                          onClick={() => handleLinkWine(wine)}
                        >
                          Link
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ))}
        </div>
      )}

      <div className="region-detail__section" id="producers">
        <h2>
          Producers{!producers.loading && ` (${producers.totalCount})`}
        </h2>
        {producers.loading ? (
          <p className="grapes-page__loading">Loading producers…</p>
        ) : producers.items.length > 0 ? (
          <>
            <ProducerTable
              producers={producers.items}
              canManage={canManageWines}
              linkContext={{ type: "region", id: region?.id, name: region?.name }}
              onProducerLinked={() => producers.reload()}
            />
            <Pagination
              page={producers.page}
              totalPages={producers.totalPages}
              totalCount={producers.totalCount}
              onPageChange={producers.setPage}
            />
          </>
        ) : (
          <p>No producers are associated with this region yet.</p>
        )}
      </div>

      <div className="region-detail__section" id="wines">
        <h2>
          Wines{!wines.loading && ` (${wines.totalCount})`}
        </h2>
        {wines.loading ? (
          <p className="grapes-page__loading">Loading wines…</p>
        ) : wines.items.length > 0 ? (
          <>
            <WineTable
              wines={wines.items}
              onDeleted={() => wines.reload()}
              linkContext={{ type: "region", id: region?.id, name: region?.name }}
              onWineLinked={() => wines.reload()}
            />
            <Pagination
              page={wines.page}
              totalPages={wines.totalPages}
              totalCount={wines.totalCount}
              onPageChange={wines.setPage}
            />
          </>
        ) : (
          <p>No wines are associated with this region yet.</p>
        )}
      </div>

      <div className="page-actions">
        <Link to="/regions" className="btn-secondary">
          ← Back to Regions
        </Link>
        {canManage && (
          <>
            <Link to={`/regions/${region.slug}/edit`} className="btn-secondary">
              Edit
            </Link>
            <button
              className="btn-action btn-action--delete"
              onClick={() => {
                if (window.confirm("Delete this region? This action cannot be undone.")) {
                  // Delete logic would go here
                }
              }}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default RegionDetail;