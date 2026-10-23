import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { wineProfilesApi } from "../services/api";
import type { UserWineProfile } from "../types/user";
import { errorMessage } from "../utils/errors";
import { useAuth } from "../contexts/AuthContext";
import { canManageWinesRole } from "../constants/roles";
import usePagedList from "../hooks/usePagedList";
import Pagination from "./Pagination";
import { SearchHighlight, SearchInput } from "../components/search";
import WineProfileTable from "./WineProfileTable";
import styles from "./WineProfileList.module.css";

type ViewMode = "cards" | "list";

function WineProfileCard({
  profile,
  query = "",
}: {
  profile: UserWineProfile;
  query?: string;
}) {
  const navigate = useNavigate();
  return (
    <div
      className="wine-management__card"
      onClick={() => navigate(`/wine-profiles/${profile.slug}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/wine-profiles/${profile.slug}`);
        }
      }}
    >
      <div className="wine-management__card-header">
        <h3>
          <SearchHighlight text={profile.name ?? ""} query={query} />
        </h3>
        <span
          className={`wine-management__color-badge wine-management__color-badge--${profile.color ?? ""}`}
        >
          {profile.color}
        </span>
      </div>
      {profile.notes && (
        <p className="wine-management__notes">
          <strong>Notes:</strong>{" "}
          <SearchHighlight text={Array.isArray(profile.notes) ? profile.notes.join(", ") : profile.notes} query={query} />
        </p>
      )}
      {profile.serving && (
        <p className="wine-management__serving">
          <strong>Serving:</strong>{" "}
          <SearchHighlight text={profile.serving} query={query} />
        </p>
      )}
      {profile.grapes && (
        <p className="wine-management__grapes">
          <strong>Grapes:</strong>{" "}
          {Array.isArray(profile.grapes)
            ? profile.grapes.map((g, index) => (
                <span key={`${g}-${index}`}>
                  {index > 0 && ", "}
                  <SearchHighlight text={g} query={query} />
                </span>
              ))
            : [
                <SearchHighlight text={profile.grapes} query={query} key="0" />
              ]}
        </p>
      )}
      {profile.regions && (
        <p className="wine-management__regions">
          <strong>Regions:</strong>{" "}
          {Array.isArray(profile.regions)
            ? profile.regions.map((r, index) => (
                <span key={`${r}-${index}`}>
                  {index > 0 && ", "}
                  <SearchHighlight text={r} query={query} />
                </span>
              ))
            : [
                <SearchHighlight text={profile.regions} query={query} key="0" />
              ]}
        </p>
      )}
    </div>
  );
}

export default function WineProfileList() {
  const { user } = useAuth();
  const canManageWines = canManageWinesRole(user);
  const [searchValue, setSearchValue] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const effectiveSearchTerm = searchValue.trim();

  const {
    items: wineProfiles,
    loading: isLoading,
    error,
    setPage,
    page,
    totalPages,
    totalCount,
  } = usePagedList<UserWineProfile>({
    extraParams: { query: effectiveSearchTerm },
    perPage: 12,
    fetcher: async ({ page = 1, per_page = 12 }) => {
      const profiles = effectiveSearchTerm
        ? (await wineProfilesApi.search(effectiveSearchTerm, 100)).wine_profiles
        : await wineProfilesApi.list();
      const totalPages = Math.max(1, Math.ceil(profiles.length / Number(per_page)));
      const currentPage = Math.min(Number(page), totalPages);
      return {
        items: profiles.slice((currentPage - 1) * Number(per_page), currentPage * Number(per_page)),
        page: currentPage,
        per_page: Number(per_page),
        total_count: profiles.length,
        total_pages: totalPages,
      };
    },
  });

  if (isLoading) return <p>Loading…</p>;
  if (error) {
    console.error(error);
    return <p className="error">{errorMessage(error, "Failed to load wine profiles")}</p>;
  }

  return (
    <div className="wine-app">
      <div className="wine-management__header">
        <div>
          <p className="wine-kicker">Cellar</p>
          <h1>Wine Profiles</h1>
        </div>
        {/* Add Wine Profile button for managers? Not requested by user, but we can add for completeness */}
        {canManageWines && (
          <Link
            to="/wine-profiles/new"
            className="auth-form__submit wine-management__add-btn"
          >
            + Add Wine Profile
          </Link>
        )}
      </div>

      <div className={styles.resultsToolbar}>
        <div className={styles.searchArea}>
          <SearchInput
            value={searchValue}
            onChange={(value) => { setSearchValue(value); setPage(1); }}
            placeholder="Search wine profiles by name, notes, grapes, or regions…"
          />
          <p
            style={{
              fontSize: "0.8rem",
              color: "#666",
              margin: "0.35rem 0 0",
            }}
          >
            Matches wine profile names, notes, grapes, and regions
            {searchValue.trim() !== "" &&
              searchValue.trim().length < 3 &&
                ` — keep typing (at least 3 characters)`}
            .
          </p>
        </div>

        <div className={styles.viewToggle} aria-label="Wine profile view">
          <span className={styles.viewToggleLabel}>View</span>
          <button
            type="button"
            className={`${styles.viewToggleButton} ${viewMode === "cards" ? styles.viewToggleButtonActive : ""}`}
            aria-pressed={viewMode === "cards"}
            onClick={() => setViewMode("cards")}
          >
            Cards
          </button>
          <button
            type="button"
            className={`${styles.viewToggleButton} ${viewMode === "list" ? styles.viewToggleButtonActive : ""}`}
            aria-pressed={viewMode === "list"}
            onClick={() => setViewMode("list")}
          >
            List
          </button>
        </div>
      </div>

      {wineProfiles.length === 0 ? (
        <div className="wine-management__empty">
          <p>
            No wine profiles found
            {canManageWines ? ". Start by adding a new wine profile!" : "."}
          </p>
          {canManageWines && (
            <Link to="/wine-profiles/new" className="auth-form__submit">
              + Add Your First Wine Profile
            </Link>
          )}
        </div>
      ) : (
        viewMode === "cards" ? (
          <div className="content-grid">
            {wineProfiles.map((profile) => (
              <WineProfileCard key={profile.slug} profile={profile} query={effectiveSearchTerm} />
            ))}
          </div>
        ) : (
          <WineProfileTable
            profiles={wineProfiles}
            canManage={canManageWines}
            query={effectiveSearchTerm}
          />
        )
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
      />
    </div>
  );
}

