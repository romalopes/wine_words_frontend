import { Link, useNavigate } from "react-router-dom";
import type { UserWineProfile } from "../types/user";
import { SearchHighlight } from "../components/search";
import styles from "./WineProfileList.module.css";

interface WineProfileTableProps {
  profiles: UserWineProfile[];
  canManage?: boolean;
  query?: string;
}

function displayValue(value: string[] | string | null | undefined): string {
  if (Array.isArray(value)) return value.join(", ");
  return value ?? "";
}

export default function WineProfileTable({
  profiles,
  canManage = false,
  query = "",
}: WineProfileTableProps) {
  const navigate = useNavigate();

  return (
    <div className={styles.tableWrap}>
      <table className="grapes-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Color</th>
            <th>Grapes</th>
            <th>Regions</th>
            <th>Notes</th>
            <th>Serving</th>
            {canManage && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {profiles.map((profile, index) => (
            <tr
              key={profile.slug}
              className={index % 2 === 0 ? "grapes-row--even" : "grapes-row--odd"}
              onClick={() => navigate(`/wine-profiles/${profile.slug}`)}
              style={{ cursor: "pointer" }}
            >
              <td>
                <Link
                  to={`/wine-profiles/${profile.slug}`}
                  className="grapes-table__link"
                  onClick={(event) => event.stopPropagation()}
                >
                  <SearchHighlight text={profile.name ?? "—"} query={query} />
                </Link>
              </td>
              <td>{profile.color ?? "—"}</td>
              <td>
                {displayValue(profile.grapes) ? (
                  <SearchHighlight text={displayValue(profile.grapes)} query={query} />
                ) : "—"}
              </td>
              <td>
                {displayValue(profile.regions) ? (
                  <SearchHighlight text={displayValue(profile.regions)} query={query} />
                ) : "—"}
              </td>
              <td>
                {displayValue(profile.notes) ? (
                  <SearchHighlight text={displayValue(profile.notes)} query={query} />
                ) : "—"}
              </td>
              <td>
                {profile.serving ? <SearchHighlight text={profile.serving} query={query} /> : "—"}
              </td>
              {canManage && (
                <td className="actions">
                  <Link
                    to={`/wine-profiles/${profile.slug}/edit`}
                    className="btn-action"
                    onClick={(event) => event.stopPropagation()}
                  >
                    Edit
                  </Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}