import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import DetailHero from "./DetailHero";
import { winesApi, producersApi, grapesApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { canManageWinesRole } from "../constants/roles";
import Pagination from "./Pagination";
import WineTable from "./WineTable";
import type { WineListItem } from "../types/wine";
import type { Producer } from "../types/producer";
import type { GrapeDetail } from "../types/catalog";

function WinesManagement() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canManage = canManageWinesRole(user);

  // --- Search input (local, debounced to URL ?query=) ---
  const [searchInput, setSearchInput] = useState(searchParams.get("query") ?? "");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const q = searchInput.trim();
      const params = new URLSearchParams(searchParams);
      if (q.length >= 3) params.set("query", q); else params.delete("query");
      params.delete("page");
      setSearchParams(params);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, searchParams, setSearchParams]);

  // --- Producer dropdown ---
  const [producers, setProducers] = useState<Producer[]>([]);
  const [producersLoading, setProducersLoading] = useState(true);

  useEffect(() => {
    producersApi.list().then((data) => {
      const list = Array.isArray(data) ? data : (data.items || []);
      setProducers(list);
      setProducersLoading(false);
    }).catch(() => {
      setProducers([]);
      setProducersLoading(false);
    });
  }, []);

  // --- Grape dropdown ---
  const [grapes, setGrapes] = useState<GrapeDetail[]>([]);
  const [grapesLoading, setGrapesLoading] = useState(true);

  useEffect(() => {
    grapesApi.list().then((data) => {
      const list = Array.isArray(data) ? data : (data.items || []);
      setGrapes(list);
      setGrapesLoading(false);
    }).catch(() => {
      setGrapes([]);
      setGrapesLoading(false);
    });
  }, []);

  // --- Read all filters from URL (source of truth) ---
  const query = searchParams.get("query") ?? "";
  const producerId = searchParams.get("producer_id") ?? "";
  const grapeId = searchParams.get("grape_id") ?? "";
  const pageFromUrl = Math.max(parseInt(searchParams.get("page") ?? "1", 10) || 1, 1);

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value); else params.delete(key);
    params.delete("page");
    setSearchParams(params);
  };

  const clearFilters = () => setSearchParams({});

  const hasActiveFilters = Boolean(query || producerId || grapeId);

  // --- Fetch wines directly ---
  const [items, setItems] = useState<WineListItem[]>([]);
  const [page, setPageState] = useState(pageFromUrl);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        setLoading(true);
        setError(null);
        const data = await winesApi.list({
          page,
          per_page: 20,
          ...(query ? { q: query } : {}),
          ...(producerId ? { producer_id: producerId } : {}),
          ...(grapeId ? { grape_id: grapeId } : {}),
        });
        if (cancelled) return;
        if (Array.isArray(data)) {
          setItems(data);
          setTotalPages(1);
          setTotalCount(data.length);
        } else {
          setItems(data.items || []);
          setPageState(data.page || page);
          setTotalPages(Math.max(data.total_pages || 1, 1));
          setTotalCount(data.total_count ?? (data.items || []).length);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load wines");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true };
  }, [page, query, producerId, grapeId]);

  // Sync page state from URL
  useEffect(() => {
    if (pageFromUrl !== page) setPageState(pageFromUrl);
  }, [pageFromUrl, page]);

  const setPage = (next: number | string) => {
    const value = Math.max(Number(next) || 1, 1);
    const params = new URLSearchParams(searchParams);
    if (value === 1) params.delete("page");
    else params.set("page", String(value));
    setSearchParams(params);
    setPageState(value);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!canManage) {
    return (
      <main className="wine-app">
        <Link to="/wines" className="wine-detail__back">
          &larr; Back to Wines
        </Link>
        <DetailHero
          kicker="Settings"
          title="Manage Wines"
          intro="Access denied. You do not have permission to manage wines."
        />
        <p className="wine-management__error" role="alert">
          You do not have permission to manage wines.
        </p>
      </main>
    );
  }

  return (
    <main className="wine-app">
      <Link to="/wines" className="wine-detail__back">
        &larr; Back to Wines
      </Link>
      <DetailHero
        kicker="Settings"
        title="Manage Wines"
        intro="Search and filter wines using your existing permissions."
        actions={
          <Link to="/wines/new" className="auth-form__submit">
            + Add Wine
          </Link>
        }
      />
      <section className="content-management__toolbar" aria-label="Wine filters">
        <label className="content-management__field">
          <span>Search</span>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search wines…"
          />
        </label>
        {!producersLoading && (
          <label className="content-management__field">
            <span>Producer</span>
            <select
              value={producerId}
              onChange={(event) => setFilter("producer_id", event.target.value)}
            >
              <option value="">All producers</option>
              {producers.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {!grapesLoading && (
          <label className="content-management__field">
            <span>Grape</span>
            <select
              value={grapeId}
              onChange={(event) => setFilter("grape_id", event.target.value)}
            >
              <option value="">All grapes</option>
              {grapes.map((g) => (
                <option key={g.id} value={String(g.id)}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {hasActiveFilters && (
          <button type="button" className="content-management__clear" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </section>
      <section aria-label="Wine results" aria-busy={loading}>
        {loading ? (
          <p className="wine-management__loading" role="status">Loading wines…</p>
        ) : error ? (
          <div role="alert">
            <p className="wine-management__error">{error}</p>
            <button type="button" className="auth-form__submit" onClick={() => {
              const params = new URLSearchParams(searchParams);
              setSearchParams(params);
            }}>
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="wine-management__empty">
            <p>
              {hasActiveFilters
                ? "No wines match your filters."
                : "No wines found. Start by adding a new wine!"}
            </p>
            {!hasActiveFilters && (
              <Link to="/wines/new" className="auth-form__submit">
                + Add Your First Wine
              </Link>
            )}
          </div>
        ) : (
          <>
            <WineTable wines={items} onDeleted={() => {
              const params = new URLSearchParams(searchParams);
              setSearchParams(params);
            }} />
            <Pagination
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </main>
  );
}

export default WinesManagement;
