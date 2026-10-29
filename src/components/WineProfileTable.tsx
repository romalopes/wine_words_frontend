import { Link, useNavigate } from "react-router-dom";
import type { UserWineProfile } from "../types/user";
import { SearchHighlight } from "../components/search";
import styles from "./WineProfileList.module.css";

interface WineProfileTableProps {
  profiles: UserWineProfile[];
  canManage?: boolean;
  query?: string;
}

function toStringArray(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
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
              className={
                index % 2 === 0 ? "grapes-row--even" : "grapes-row--odd"
              }
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
                {(() => {
                  const plainGrapes = toStringArray(profile.grapes);
                  const linkedGrapes = Array.isArray(profile.profile_grapes)
                    ? profile.profile_grapes
                    : [];
                  if (plainGrapes.length === 0 && linkedGrapes.length === 0) {
                    return "—";
                  }
                  return (
                    <>
                      {plainGrapes.map((grape, i) => (
                        <span
                          key={`grape-plain-${index}-${i}`}
                          className="wine-profile-detail__chip"
                        >
                          {grape}
                        </span>
                      ))}
                      {linkedGrapes.map((grape) => (
                        <Link
                          key={`grape-linked-${grape.slug ?? grape.id}`}
                          to={`/grapes/${encodeURIComponent(grape.slug)}`}
                          className="wine-profile-detail__chip wine-profile-detail__chip--region"
                        >
                          {grape.name}
                        </Link>
                      ))}
                    </>
                  );
                })()}
              </td>
              <td>
                {(() => {
                  const plainRegions = toStringArray(profile.regions);
                  const linkedRegions = Array.isArray(profile.profile_regions)
                    ? profile.profile_regions
                    : [];
                  if (plainRegions.length === 0 && linkedRegions.length === 0) {
                    return "—";
                  }
                  return (
                    <>
                      {plainRegions.map((region, i) => (
                        <span
                          key={`region-plain-${index}-${i}`}
                          className="wine-profile-detail__chip"
                        >
                          {region}
                        </span>
                      ))}
                      {linkedRegions.map((region) => (
                        <Link
                          key={`region-linked-${region.slug ?? region.id}`}
                          to={`/regions/${encodeURIComponent(region.slug)}`}
                          className="wine-profile-detail__chip wine-profile-detail__chip--region"
                        >
                          {region.name}
                        </Link>
                      ))}
                    </>
                  );
                })()}
              </td>
              <td>
                {(() => {
                  const notesArray = Array.isArray(profile.notes)
                    ? profile.notes
                    : typeof profile.notes === "string" &&
                        profile.notes.length > 0
                      ? JSON.parse(profile.notes)
                      : [];
                  if (notesArray.length === 0) return "—";
                  return (
                    <>
                      {notesArray.map((note: string, index: number) => (
                        <span
                          key={`note-${index}`}
                          className="wine-profile-detail__chip wine-profile-detail__chip--note"
                        >
                          {note}
                        </span>
                      ))}
                    </>
                  );
                })()}
              </td>
              <td>
                {profile.serving ? (
                  <SearchHighlight text={profile.serving} query={query} />
                ) : (
                  "—"
                )}
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
