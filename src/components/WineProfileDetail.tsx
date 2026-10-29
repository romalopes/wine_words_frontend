import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import DetailHero from "./DetailHero";
import { wineProfilesApi, tasteParametersApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { canManageWinesRole } from "../constants/roles";
import type { UserWineProfile } from "../types/user";
import type { TasteParameter } from "../types/catalog";
import { tasteScoreText } from "../utils/tasteParameters";

export default function WineProfileDetail() {
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const canManageWines = canManageWinesRole(user);
  const [profile, setProfile] = useState<UserWineProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasteParameters, setTasteParameters] = useState<
    Record<string, TasteParameter>
  >({});

  useEffect(() => {
    async function fetchData() {
      try {
        const [profileRes, labelsRes] = await Promise.all([
          wineProfilesApi.show(slug),
          tasteParametersApi.list(),
        ]);
        setProfile(profileRes);
        setTasteParameters(
          labelsRes.reduce<Record<string, TasteParameter>>(
            (parameters, parameter) => {
              parameters[parameter.slug] = parameter;
              return parameters;
            },
            {},
          ),
        );
      } catch (err) {
        console.error(err);
        setError("Failed to load wine profile");
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchData();
    }
  }, [slug]);

  if (loading) return <p>Loading…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!profile) return <p>Wine profile not found</p>;

  const notes: string[] =
    (typeof profile.notes === "string"
      ? JSON.parse(profile.notes)
      : profile.notes) ?? [];
  const grapes = Array.isArray(profile.grapes)
    ? profile.grapes
    : profile.grapes
      ? [profile.grapes]
      : [];
  const regions = Array.isArray(profile.regions)
    ? profile.regions
    : profile.regions
      ? [profile.regions]
      : [];
  // The API always serialises these as arrays (possibly empty), but the type
  // allows null — normalise defensively so .length / .map never throw.
  const profileGrapes = profile.profile_grapes ?? [];
  const profileRegions = profile.profile_regions ?? [];
  const parameters = Object.entries(profile.parameters ?? {});

  return (
    <div className="wine-app">
      <main className="wine-profile-detail">
        <Link to="/wine-profiles" className="wine-detail__back">
          &larr; Back to wine profiles
        </Link>

        <DetailHero
          kicker="Wine profile"
          title={profile.name}
          badge={
            profile.color
              ? { label: profile.color, tone: profile.color }
              : undefined
          }
          intro="A reference tasting profile for exploring a wine’s character and origins."
          actions={
            canManageWines ? (
              <Link
                to={`/wine-profiles/${profile.slug}/edit`}
                className="auth-form__submit"
              >
                Edit Profile
              </Link>
            ) : undefined
          }
        />

        <div className="wine-profile-detail__layout">
          <div className="wine-profile-detail__main">
            {notes.length > 0 && (
              <section className="reference-detail__card">
                <p className="wine-profile-detail__eyebrow">Tasting notes</p>
                <h2>What to expect</h2>
                <div
                  className="wine-profile-detail__chips"
                  aria-label="Tasting notes"
                >
                  {notes.map((note, index) => (
                    <span
                      key={`${note}-${index}`}
                      className="wine-profile-detail__chip wine-profile-detail__chip--note"
                    >
                      {note}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {profile.serving && (
              <section className="wine-profile-detail__serving">
                <div
                  className="wine-profile-detail__serving-icon"
                  aria-hidden="true"
                >
                  ✦
                </div>
                <div>
                  <p className="wine-profile-detail__eyebrow">
                    Serving suggestion
                  </p>
                  <p>{profile.serving}</p>
                </div>
              </section>
            )}

            {parameters.length > 0 && (
              <section className="wine-profile-detail__section">
                <p className="wine-profile-detail__eyebrow">Taste profile</p>
                <h2>On the palate</h2>
                <div className="wine-profile-detail__params">
                  {parameters.map(([parameterSlug, score]) => (
                    <div
                      key={parameterSlug}
                      className="wine-profile-detail__param"
                    >
                      <div className="wine-profile-detail__param-heading">
                        <span>
                          {tasteParameters[parameterSlug]?.label ||
                            parameterSlug}
                        </span>
                        <strong>
                          {tasteParameters[parameterSlug]
                            ? tasteScoreText(
                                tasteParameters[parameterSlug],
                                score,
                              )
                            : `${score} / 5`}
                        </strong>
                      </div>
                      <div
                        className="wine-meter"
                        aria-label={`${tasteParameters[parameterSlug]?.label || parameterSlug}: ${score} out of 5`}
                      >
                        <span style={{ width: `${(score / 5) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {(grapes.length > 0 || regions.length > 0) && (
            <aside
              className="wine-profile-detail__origins"
              aria-label="Grapes and regions"
            >
              <div className="wine-profile-detail__origin-group">
                <p className="wine-profile-detail__eyebrow">Grapes</p>
                {grapes.length + profileGrapes.length > 0 && (
                  <div className="wine-profile-detail__chips">
                    {grapes.length > 0 &&
                      grapes.map((grape) => (
                        <span key={grape} className="wine-profile-detail__chip">
                          {grape}
                        </span>
                      ))}

                    {profileGrapes.map((grape) => (
                      <Link
                        key={grape.slug ?? grape.id}
                        to={`/grapes/${encodeURIComponent(grape.slug)}`}
                        className="wine-profile-detail__chip wine-profile-detail__chip--region"
                      >
                        {grape.name}
                      </Link>
                    ))}
                    {grapes.length + profileGrapes.length == 0 && (
                      <p className="wine-profile-detail__empty">
                        Not specified
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="wine-profile-detail__origin-divider" />
              <div className="wine-profile-detail__origin-group">
                <p className="wine-profile-detail__eyebrow">Regions</p>

                {regions.length + profileRegions.length > 0 && (
                  <div className="wine-profile-detail__chips">
                    {regions.length > 0 &&
                      regions.map((region) => (
                        <span
                          key={region}
                          className="wine-profile-detail__chip"
                        >
                          {region}
                        </span>
                      ))}
                    {profileRegions.map((region) => (
                      <Link
                        key={region.slug ?? region.id}
                        to={`/regions/${encodeURIComponent(region.slug)}`}
                        className="wine-profile-detail__chip wine-profile-detail__chip--region"
                      >
                        {region.name}
                      </Link>
                    ))}
                    {regions.length + profileRegions.length == 0 && (
                      <p className="wine-profile-detail__empty">
                        Not specified
                      </p>
                    )}
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
