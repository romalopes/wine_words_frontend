import { Link } from "react-router-dom";
import { producersApi, countriesApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { canManageWinesRole } from "../constants/roles";
import usePagedList from "../hooks/usePagedList";
import Pagination from "./Pagination";
import ProducerTable from "./ProducerTable";
import { useState, useEffect, useMemo } from "react";
import type { CountryListItem } from "../types/reference";
import styles from "./ProducerList.module.css";

const PRODUCER_TYPES = [
  "winery",
  "negociant",
  "cooperative",
  "wine_company",
  "independent_producer"
] as const;

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" }
] as const;

function ProducerList() {
  const { user } = useAuth();
  const canManageProducers = canManageWinesRole(user);

  // Filter state - local only (no URL sync to avoid page reloads)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountryId, setSelectedCountryId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [countries, setCountries] = useState<CountryListItem[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);

  // Debounced search query for API calls
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  // Fetch countries with producers on mount
  useEffect(() => {
    countriesApi.list({ include_wine_counts: false }).then((data) => {
      const countryList = Array.isArray(data) ? data : (data.items || []);
      setCountries(countryList.filter(c => c.producers_count > 0));
      setCountriesLoading(false);
    }).catch(() => {
      setCountries([]);
      setCountriesLoading(false);
    });
  }, []);

  // Debounce searches; shorter input leaves the name filter inactive.
  useEffect(() => {
    const timer = setTimeout(() => {
      const query = searchQuery.trim();
      setDebouncedSearchQuery(query.length >= 3 ? query : "");
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle filter changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value ? Number(e.target.value) : null;
    setSelectedCountryId(value);
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedType(e.target.value);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedStatus(e.target.value);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCountryId(null);
    setSelectedType("");
    setSelectedStatus("");
  };

  const hasActiveFilters = searchQuery || selectedCountryId || selectedType || selectedStatus;

  // Extra params for usePagedList - triggers refetch when filters change
  const extraParams = useMemo(() => ({
    q: debouncedSearchQuery || undefined,
    country_id: selectedCountryId || undefined,
    producer_type: selectedType || undefined,
    active: selectedStatus || undefined,
  }), [debouncedSearchQuery, selectedCountryId, selectedType, selectedStatus]);

  const list = usePagedList({
    fetcher: (params) => producersApi.list(params),
    extraParams,
  });

  return (
    <div className="wine-app">
      <div className="wine-management__header">
        <div>
          <p className="wine-kicker">Cellar</p>
          <h1>Producers</h1>
        </div>
        {canManageProducers && (
          <Link
            to="/producers/new"
            className="auth-form__submit wine-management__add-btn"
          >
            + Add Producer
          </Link>
        )}
      </div>

      {/* Filters Bar */}
      <div className={styles.producersFilters}>
        <div className={styles.producersFiltersRow}>
          <div className={styles.producersFiltersField}>
            <label htmlFor="producer-search" className={styles.producersFiltersLabel}>Search</label>
            <input
              type="text"
              id="producer-search"
              className={styles.producersFiltersInput}
              placeholder="Search by name (at least 3 characters)…"
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>

          <div className={styles.producersFiltersField}>
            <label htmlFor="producer-country" className={styles.producersFiltersLabel}>Country</label>
            <select
              id="producer-country"
              className={styles.producersFiltersSelect}
              value={selectedCountryId ?? ""}
              onChange={handleCountryChange}
              disabled={countriesLoading}
            >
              <option value="">All Countries</option>
              {countries.map(country => (
                <option key={country.id} value={country.id}>
                  {country.flag_emoji ? `${country.flag_emoji} ` : ""}{country.name} ({country.producers_count})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.producersFiltersField}>
            <label htmlFor="producer-type" className={styles.producersFiltersLabel}>Type</label>
            <select
              id="producer-type"
              className={styles.producersFiltersSelect}
              value={selectedType}
              onChange={handleTypeChange}
            >
              <option value="">All Types</option>
              {PRODUCER_TYPES.map(type => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.producersFiltersField}>
            <label htmlFor="producer-status" className={styles.producersFiltersLabel}>Status</label>
            <select
              id="producer-status"
              className={styles.producersFiltersSelect}
              value={selectedStatus}
              onChange={handleStatusChange}
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <div className={`${styles.producersFiltersField} ${styles.producersFiltersFieldClear}`}>
              <button
                type="button"
                className={styles.producersFiltersClearBtn}
                onClick={handleClearFilters}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      <section aria-label="Producer results" aria-busy={list.loading}>
        {list.loading ? (
          <p className="wine-management__loading" role="status">Loading producers…</p>
        ) : list.error ? (
          <div role="alert">
            <p className="wine-management__error">{list.error}</p>
            <button className="auth-form__submit" onClick={list.reload}>
              Retry
            </button>
          </div>
        ) : list.items.length === 0 ? (
          <div className="wine-management__empty">
            <p>
              {hasActiveFilters
                ? "No producers match your filters. Try adjusting your search criteria."
                : "No producers found. Start by adding a new producer!"}
            </p>
            {!hasActiveFilters && canManageProducers && (
              <Link to="/producers/new" className="auth-form__submit">
                + Add Your First Producer
              </Link>
            )}
          </div>
        ) : (
          <>
            <ProducerTable
              producers={list.items}
              canManage={canManageProducers}
            />
            <Pagination
              page={list.page}
              totalPages={list.totalPages}
              totalCount={list.totalCount}
              onPageChange={list.setPage}
            />
          </>
        )}
      </section>
    </div>
  );
}

export default ProducerList;
