import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { wineProfilesApi, tasteParametersApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { canManageWinesRole } from "../constants/roles";
import type { UserWineProfile } from "../types/user";

function asList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

export default function WineProfileDetail() {
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const canManageWines = canManageWinesRole(user);
  const [profile, setProfile] = useState<UserWineProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasteLabels, setTasteLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        const [profileRes, labelsRes] = await Promise.all([
          wineProfilesApi.show(slug),
          tasteParametersApi.list(),
        ]);
        setProfile(profileRes);
        setTasteLabels(labelsRes.reduce<Record<string, string>>((labels, parameter) => {
          labels[parameter.slug] = parameter.label;
          return labels;
        }, {}));
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

  const notes = asList(profile.notes);
  const grapes = asList(profile.grapes);
  const regions = asList(profile.regions);
  const parameters = Object.entries(profile.parameters ?? {});
  const colorClass = profile.color?.toLowerCase().replace(/\s+/g, "-") || "unknown";

  return (
    <div className="wine-app">
      <main className="wine-profile-detail">
        <Link to="/wine-profiles" className="wine-detail__back">
          &larr; Back to wine profiles
        </Link>

        <header className="wine-profile-detail__hero">
          <div>
            <p className="wine-kicker">Wine profile</p>
            <div className="wine-profile-detail__title-row">
              <h1>{profile.name}</h1>
              {profile.color && <span className={`wine-profile-detail__color wine-profile-detail__color--${colorClass}`}>{profile.color}</span>}
            </div>
            <p className="wine-profile-detail__intro">A reference tasting profile for exploring a wine’s character and origins.</p>
          </div>
          {canManageWines && <Link to={`/wine-profiles/${profile.slug}/edit`} className="auth-form__submit wine-profile-detail__edit">Edit Profile</Link>}
        </header>

        <div className="wine-profile-detail__layout">
          <div className="wine-profile-detail__main">
            {notes.length > 0 && (
              <section className="wine-profile-detail__section">
                <p className="wine-profile-detail__eyebrow">Tasting notes</p>
                <h2>What to expect</h2>
                <div className="wine-profile-detail__chips" aria-label="Tasting notes">
                  {notes.map((note, index) => <span key={`${note}-${index}`} className="wine-profile-detail__chip wine-profile-detail__chip--note">{note}</span>)}
                </div>
              </section>
            )}

            {profile.serving && (
              <section className="wine-profile-detail__serving">
                <div className="wine-profile-detail__serving-icon" aria-hidden="true">✦</div>
                <div><p className="wine-profile-detail__eyebrow">Serving suggestion</p><p>{profile.serving}</p></div>
              </section>
            )}

            {parameters.length > 0 && (
              <section className="wine-profile-detail__section">
                <p className="wine-profile-detail__eyebrow">Taste profile</p>
                <h2>On the palate</h2>
                <div className="wine-profile-detail__params">
                  {parameters.map(([parameterSlug, score]) => (
                    <div key={parameterSlug} className="wine-profile-detail__param">
                      <div className="wine-profile-detail__param-heading"><span>{tasteLabels[parameterSlug] || parameterSlug}</span><strong>{score}<small>/5</small></strong></div>
                      <div className="wine-meter" aria-label={`${tasteLabels[parameterSlug] || parameterSlug}: ${score} out of 5`}><span style={{ width: `${(score / 5) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {(grapes.length > 0 || regions.length > 0) && (
            <aside className="wine-profile-detail__origins" aria-label="Grapes and regions">
              <div className="wine-profile-detail__origin-group">
                <p className="wine-profile-detail__eyebrow">Grapes</p>
                {grapes.length > 0 ? <div className="wine-profile-detail__chips">{grapes.map((grape, index) => <span key={`${grape}-${index}`} className="wine-profile-detail__chip">{grape}</span>)}</div> : <p className="wine-profile-detail__empty">Not specified</p>}
              </div>
              <div className="wine-profile-detail__origin-divider" />
              <div className="wine-profile-detail__origin-group">
                <p className="wine-profile-detail__eyebrow">Regions</p>
                {regions.length > 0 ? <div className="wine-profile-detail__chips">{regions.map((region, index) => <span key={`${region}-${index}`} className="wine-profile-detail__chip wine-profile-detail__chip--region">{region}</span>)}</div> : <p className="wine-profile-detail__empty">Not specified</p>}
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}