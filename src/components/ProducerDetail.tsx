import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { producersApi, winesApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { canManageWinesRole } from "../constants/roles";
import WineTable from "./WineTable";
import RegionSearch from "./RegionSearch";
import GrapeSearch from "./GrapeSearch";
import BackToSource from "./BackToSource";
import usePagedList from "../hooks/usePagedList";
import Pagination from "./Pagination";

function ProducerDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  // Admins, Reviewers and Editors may manage producers / link wines.
  const canManageProducers = canManageWinesRole(user);
  const [producer, setProducer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Inline wine search for linking wines to this producer.
  const [wineQuery, setWineQuery] = useState("");
  const [wineResults, setWineResults] = useState(null);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState(null);

  // Region / grape link editors (search pickers + save).
  const [regionsEditorOpen, setRegionsEditorOpen] = useState(false);
  const [grapesEditorOpen, setGrapesEditorOpen] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [selectedGrapes, setSelectedGrapes] = useState([]);
  const [savingLinks, setSavingLinks] = useState(false);

  const loadProducer = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await producersApi.show(slug);
      setProducer(data);
      // Keep the link editors in sync with the freshly loaded producer.
      setSelectedRegions(
        (data.regions || []).map((r) => ({ id: r.id, name: r.name })),
      );
      setSelectedGrapes(
        (data.grapes || []).map((g) => ({ id: g.id, name: g.name })),
      );
    } catch (err) {
      setError(err.message || "Failed to load producer");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadProducer();
  }, [loadProducer]);

  // Fetch paginated wines for this producer
  const { items: paginatedWines, page, setPage, totalPages, totalCount, loading: winesLoading, error: winesError, reload: reloadWines } = usePagedList({
    fetcher: async (params) => {
      const response = await winesApi.list({ producer_id: producer?.id, ...params });
      // The API returns either a paginated envelope or a bare array
      if (Array.isArray(response)) {
        // If it's a bare array, convert to paginated format
        return {
          items: response,
          page: params.page || 1,
          per_page: params.per_page || 20,
          total_count: response.length,
          total_pages: Math.ceil(response.length / (params.per_page || 20)),
        };
      }
      return response;
    },
    extraParams: producer && producer.id !== undefined ? { producer_id: producer.id } : {},
    enabled: !!producer, // Only enable when producer is loaded
    paramKey: "wine_page",
    perPage: 20,
  });

  // Debounced wine search for the linking UI.
  useEffect(() => {
    if (!canManageProducers) return undefined;
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
  }, [wineQuery, canManageProducers]);

  async function handleLinkWine(wine) {
    const current = wine.producer?.name;
    const message =
      current && current !== producer.name
        ? `"${wine.name}" is currently linked to "${current}". Reassign it to "${producer.name}"?`
        : `Link "${wine.name}" to "${producer.name}"?`;
    if (!window.confirm(message)) return;
    setLinking(true);
    setLinkError(null);
    try {
      await winesApi.update(wine.slug, { producer_id: producer.id });
      await loadProducer();
      reloadWines();
    } catch (err) {
      setLinkError(err.message || "Failed to link wine");
    } finally {
      setLinking(false);
    }
  }

  // Save the (full) region list for this producer. The API replaces the
  // producer's regions with the supplied ids, so unlinking is just removing
  // a chip from the picker before saving.
  async function handleSaveRegions() {
    setSavingLinks(true);
    setLinkError(null);
    try {
      await producersApi.update(slug, {
        region_ids: selectedRegions.map((r) => r.id),
      });
      await loadProducer();
      setRegionsEditorOpen(false);
    } catch (err) {
      setLinkError(err.message || "Failed to update regions");
    } finally {
      setSavingLinks(false);
    }
  }

  async function handleSaveGrapes() {
    setSavingLinks(true);
    setLinkError(null);
    try {
      await producersApi.update(slug, {
        grape_ids: selectedGrapes.map((g) => g.id),
      });
      await loadProducer();
      setGrapesEditorOpen(false);
    } catch (err) {
      setLinkError(err.message || "Failed to update grapes");
    } finally {
      setSavingLinks(false);
    }
  }

  if (loading) {
    return (
      <div className="wine-app">
        <p className="wine-management__loading">Loading producer details…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wine-app">
        <p className="wine-management__error">{error}</p>
        <Link to="/producers" className="auth-form__submit">
          Back to Producers
        </Link>
      </div>
    );
  }

  if (!producer) return null;

  return (
    <div className="wine-app">
      <BackToSource />
      <Link to="/producers" className="wine-detail__back">
        &larr; Back to Producers
      </Link>
      <div className="wine-detail__header">
        <div>
          <p className="wine-kicker">Producer</p>
          <h1>{producer.name}</h1>
        </div>
      </div>

      {producer.logo_url && (
        <div style={{ margin: "0 0 1rem" }}>
          <img
            src={producer.logo_url}
            alt={`${producer.name} logo`}
            style={{ maxWidth: 180 }}
          />
        </div>
      )}

      {Array.isArray(producer.images) && producer.images.length > 0 && (
        <div className="wine-detail__images">
          {producer.images.map((src, i) => (
            <img key={i} src={src} alt={`${producer.name} ${i + 1}`} />
          ))}
        </div>
      )}

      <section className="detail-card">
        <ul className="facts" aria-label="Producer details">
          <li>
            <strong>Status:</strong>{" "}
            {producer.active === false ? "Inactive" : "Active"}
          </li>
          <li>
            <strong>Country:</strong>{" "}
            {producer.country
              ? `${producer.country.flag_emoji || ""} ${producer.country.name}`.trim()
              : "—"}
          </li>
          <li>
            <strong>Legal name:</strong> {producer.legal_name || "—"}
          </li>
          <li>
            <strong>Address:</strong> {producer.address?.street_address || "—"}
          </li>
          <li>
            <strong>Location:</strong>{" "}
            {[
              producer.address?.city,
              producer.address?.state,
              producer.address?.postal_code,
            ]
              .filter(Boolean)
              .join(", ") || "—"}
          </li>
          <li>
            <strong>Phone:</strong> {producer.phone || "—"}
          </li>
          <li>
            <strong>Founded:</strong> {producer.founded_year || "—"}
          </li>
          <li>
            <strong>Type:</strong>{" "}
            {producer.producer_type
              ? producer.producer_type
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())
              : "—"}
          </li>
          <li>
            <strong>Email:</strong>{" "}
            {producer.email ? (
              <a href={`mailto:${producer.email}`}>{producer.email}</a>
            ) : (
              "—"
            )}
          </li>
          <li>
            <strong>Website:</strong>{" "}
            {producer.website ? (
              <a href={producer.website} target="_blank" rel="noreferrer">
                {producer.website}
              </a>
            ) : (
              "—"
            )}
          </li>
          <li>
            <strong>Instagram:</strong>{" "}
            {producer.instagram ? (
              <a
                href={
                  producer.instagram.startsWith("http")
                    ? producer.instagram
                    : `https://instagram.com/${producer.instagram.replace("@", "")}`
                }
                target="_blank"
                rel="noreferrer"
              >
                {producer.instagram}
              </a>
            ) : (
              "—"
            )}
          </li>
          <li>
            <strong>Facebook:</strong>{" "}
            {producer.facebook ? (
              <a
                href={
                  producer.facebook.startsWith("http")
                    ? producer.facebook
                    : `https://facebook.com/${producer.facebook}`
                }
                target="_blank"
                rel="noreferrer"
              >
                {producer.facebook}
              </a>
            ) : (
              "—"
            )}
          </li>
          <li>
            <strong>Description:</strong> {producer.description || "—"}
          </li>
        </ul>
      </section>

      {canManageProducers && (
        <div className="wine-detail__actions">
          <Link
            to={`/producers/${producer.slug}/edit`}
            className="auth-form__submit"
          >
            Edit Producer
          </Link>
          <button
            className="wine-management__delete-btn"
            onClick={async () => {
              if (
                !window.confirm(
                  `Delete "${producer.name}"? This action cannot be undone.`,
                )
              )
                return;
              try {
                await producersApi.destroy(producer.slug);
                navigate("/producers", { replace: true });
              } catch (err) {
                alert(err.message || "Failed to delete producer");
              }
            }}
          >
            Delete Producer
          </button>
        </div>
      )}

      <div className="wine-detail__section">
        <div className="wine-management__header">
          <h2>Regions</h2>
          {canManageProducers && (
            <button
              type="button"
              className="review-form__status-btn"
              onClick={() => setRegionsEditorOpen((open) => !open)}
            >
              {regionsEditorOpen ? "Close" : "+ Link Region"}
            </button>
          )}
        </div>
        {linkError && regionsEditorOpen && (
          <p className="review-form__error">{linkError}</p>
        )}
        <p>
          {Array.isArray(producer.regions) && producer.regions.length > 0
            ? producer.regions
                .map((r) =>
                  r.country_name ? `${r.name} (${r.country_name})` : r.name,
                )
                .join(", ")
            : "No regions linked yet."}
        </p>
        {canManageProducers && regionsEditorOpen && (
          <div className="review-form__field">
            <RegionSearch
              selected={selectedRegions}
              onChange={setSelectedRegions}
              countryId={producer.country?.id}
            />
            <button
              type="button"
              className="review-form__status-btn"
              disabled={savingLinks}
              onClick={handleSaveRegions}
            >
              {savingLinks ? "Saving…" : "Save Regions"}
            </button>
          </div>
        )}
      </div>

      <div className="wine-detail__section">
        <div className="wine-management__header">
          <h2>Grapes</h2>
          {canManageProducers && (
            <button
              type="button"
              className="review-form__status-btn"
              onClick={() => setGrapesEditorOpen((open) => !open)}
            >
              {grapesEditorOpen ? "Close" : "+ Link Grapes"}
            </button>
          )}
        </div>
        {linkError && grapesEditorOpen && !regionsEditorOpen && (
          <p className="review-form__error">{linkError}</p>
        )}
        <p>
          {Array.isArray(producer.grapes) && producer.grapes.length > 0
            ? producer.grapes
                .map((g) => (g.color ? `${g.name} (${g.color})` : g.name))
                .join(", ")
            : "No grapes linked yet."}
        </p>
        {canManageProducers && grapesEditorOpen && (
          <div className="review-form__field">
            <GrapeSearch
              selected={selectedGrapes}
              onChange={setSelectedGrapes}
            />
            <button
              type="button"
              className="review-form__status-btn"
              disabled={savingLinks}
              onClick={handleSaveGrapes}
            >
              {savingLinks ? "Saving…" : "Save Grapes"}
            </button>
          </div>
        )}
      </div>

      {/* {canManageProducers && (
        <div className="wine-detail__section">
          <h2>Link a Wine</h2>
          <div className="review-form__field">
            <label htmlFor="producer-wine-search">
              Search wines by name to link them to {producer.name}
            </label>
            <input
              id="producer-wine-search"
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
                style={{
                  display: "grid",
                  gap: 6,
                  listStyle: "none",
                  padding: 0,
                }}
              >
                {wineResults.map((wine) => {
                  const linkedHere =
                    wine.producer?.slug === producer.slug ||
                    wine.producer?.id === producer.id;
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
                        <>
                          <span style={{ color: "#666", fontSize: ".85rem" }}>
                            {wine.producer?.name
                              ? `currently with ${wine.producer.name}`
                              : "no producer"}
                          </span>
                          <button
                            type="button"
                            className="review-form__status-btn"
                            disabled={linking}
                            onClick={() => handleLinkWine(wine)}
                          >
                            Link
                          </button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            ))}
        </div>
      )} */}

      {/* {Array.isArray(producer.wines) &&
        producer.wines.length > 0 &&
        (() => {
          const categoryMap = new Map();
          producer.wines.forEach((w) => {
            const cats =
              w.categories ||
              (w.category ? [{ id: w.category_id, name: w.category }] : []);
            cats.forEach((c) => {
              if (c && c.id && !categoryMap.has(c.id)) categoryMap.set(c.id, c);
            });
          });
          const categories = Array.from(categoryMap.values());
          if (categories.length === 0) return null;
          return (
            <div className="wine-detail__section">
              <h2>Categories</h2>
              <p>
                {categories
                  .map((c) => (
                    <Link
                      key={c.id}
                      to={`/categories/${c.slug}`}
                      style={{ marginRight: 8 }}
                    >
                      {c.name}
                    </Link>
                  ))
                  .reduce(
                    (prev, curr, i) =>
                      i === 0 ? [curr] : [...prev, ", ", curr],
                    [],
                  )}
              </p>
            </div>
          );
        })()} */}
      {canManageProducers && (
        <div className="wine-detail__section">
          <h2>Link a Wine</h2>
          <div className="review-form__field">
            <label htmlFor="producer-wine-search">
              Search wines by name to link them to {producer.name}
            </label>
            <input
              id="producer-wine-search"
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
                style={{
                  display: "grid",
                  gap: 6,
                  listStyle: "none",
                  padding: 0,
                }}
              >
                {wineResults.map((wine) => {
                  const linkedHere =
                    wine.producer?.slug === producer.slug ||
                    wine.producer?.id === producer.id;
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
                        <>
                          <span style={{ color: "#666", fontSize: ".85rem" }}>
                            {wine.producer?.name
                              ? `currently with ${wine.producer.name}`
                              : "no producer"}
                          </span>
                          <button
                            type="button"
                            className="review-form__status-btn"
                            disabled={linking}
                            onClick={() => handleLinkWine(wine)}
                          >
                            Link
                          </button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            ))}
        </div>
      )}

      <div className="wine-detail__section">
        <h2>Wines</h2>
        {winesLoading ? (
          <p className="wine-management__loading">Loading wines...</p>
        ) : winesError ? (
          <p className="wine-management__error">Failed to load wines: {winesError}</p>
        ) : paginatedWines !== null && paginatedWines.length > 0 ? (
          <>
            <WineTable
              wines={paginatedWines}
              onDeleted={(deleted) => {
                // Reload current page when a wine is deleted
                reloadWines();
              }}
              linkContext={{
                type: "producer",
                id: producer?.id || 0,
                name: producer?.name || "",
              }}
              onWineLinked={() => {
                // Reload current page when a wine is linked
                reloadWines();
              }}
            />
            <Pagination
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              onPageChange={setPage}
              alwaysShow={totalPages > 1}
            />
          </>
        ) : (
          <p className="wine-management__empty-state">
            No wines are associated with this producer yet.
          </p>
        )}
      </div>
    </div>
  );
}

export default ProducerDetail;
