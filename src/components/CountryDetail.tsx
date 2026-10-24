import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DetailHero from "./DetailHero";
import { countriesApi, producersApi, winesApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { canManageWinesRole } from "../constants/roles";
import WineTable from "./WineTable";
import ProducerTable from "./ProducerTable";
import Pagination from "./Pagination";
import usePagedList from "../hooks/usePagedList";
import BackToSource from "./BackToSource";
import { errorMessage } from "../utils/errors";
import type { CountryDetail as CountryDetailData } from "../types/reference";
import type { Producer } from "../types/producer";
import type { WineListItem } from "../types/wine";

function CountryDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const canManageProducers = canManageWinesRole(user);
  const [country, setCountry] = useState<CountryDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Paginated per-country lists (independent URL params so paging one
  // section does not disturb the other).
  const producers = usePagedList<Producer>({
    fetcher: (params) => producersApi.list({ ...params, country_id: country?.id }),
    enabled: Boolean(country?.id),
    paramKey: "producer_page",
     perPage: 20,
  });
  const wines = usePagedList<WineListItem>({
    fetcher: (params) => winesApi.list({ ...params, country_id: country?.id }),
    enabled: Boolean(country?.id),
    paramKey: "page",
     perPage: 20,
  });

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    countriesApi
      .show(slug)
      .then((data) => {
        if (!cancelled) setCountry(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, "Failed to load country"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // If we navigated here from a country-list count link ("#producers" /
  // "#wines"), scroll to the relevant section once the country has loaded.
  useEffect(() => {
    if (!country) return;
    const hash = window.location.hash;
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    }
  }, [country]);

  if (loading) {
    return (
      <div className="grapes-page">
        <p className="grapes-page__loading">Loading country…</p>
      </div>
    );
  }

  if (error || !country) {
    return (
      <div className="grapes-page">
        {error && <div className="flash flash--alert">{error}</div>}
        <BackToSource />
        <Link to="/countries" className="back-link">
          &larr; Back to countries
        </Link>
      </div>
    );
  }

  return (
    <div className="grapes-page">
      <Link to="/countries" className="back-link">
        &larr; Back to countries
      </Link>
      <DetailHero
        kicker="Country"
        title={`${country.flag_emoji} ${country.name}`}
      />

      <div className="grape-detail">
        <ul className="facts">
          <li>
            <strong>ISO code:</strong> {country.code}
          </li>
          <li>
            <strong>Continent:</strong> {country.continent || "—"}
          </li>
          <li>
            <strong>Wine country:</strong>{" "}
            {country.is_wine_country ? "Yes" : "No"}
          </li>
        </ul>
      </div>

      <section id="producers" className="country-detail__section">
        <h2>
          Producers{!producers.loading && ` (${producers.totalCount})`}
        </h2>
        {producers.loading ? (
          <p className="wine-management__loading">Loading producers…</p>
        ) : producers.items.length > 0 ? (
          <>
            <ProducerTable
              producers={producers.items}
              canManage={canManageProducers}
              linkContext={{ type: "country", id: country.id, name: country.name }}
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
          <p>No producers for this country yet.</p>
        )}
      </section>

      <section id="wines" className="country-detail__section">
        <h2>
          Wines{!wines.loading && ` (${wines.totalCount})`}
        </h2>
        {wines.loading ? (
          <p className="wine-management__loading">Loading wines…</p>
        ) : wines.items.length > 0 ? (
          <>
            <WineTable
              wines={wines.items}
              linkContext={{ type: "country", id: country.id, name: country.name }}
              onWineLinked={() => wines.reload()}
              onDeleted={() => wines.reload()}
            />
            <Pagination
              page={wines.page}
              totalPages={wines.totalPages}
              totalCount={wines.totalCount}
              onPageChange={wines.setPage}
            />
          </>
        ) : (
          <p>No wines for this country yet.</p>
        )}
      </section>
    </div>
  );
}

export default CountryDetail;