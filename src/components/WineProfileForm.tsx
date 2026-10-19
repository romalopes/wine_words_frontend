import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  wineProfilesApi,
  tasteParametersApi,
} from "../services/api";
import GrapeSearch, { type SelectedGrape } from "./GrapeSearch";
import RegionSearch, { type SelectedRegion } from "./RegionSearch";
import TasteParameterSliders from "./TasteParameterSliders";
import { errorMessage } from "../utils/errors";
import type { UserWineProfile } from "../types/user";
import type { TasteParameter } from "../types/catalog";

function WineProfileForm() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(slug);

  const [formData, setFormData] = useState<Partial<UserWineProfile>>({
    name: "",
    color: "",
    notes: "",
    serving: "",
    grapes: [],
    regions: [],
    parameters: {},
  });

  const [selectedGrapes, setSelectedGrapes] = useState<SelectedGrape[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<SelectedRegion[]>([]);
  const [tasteParams, setTasteParams] = useState<TasteParameter[]>([]);
  const [tasteScores, setTasteScores] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initForm() {
      setLoading(true);
      if (isEditing && slug) {
        try {
          const profile = await wineProfilesApi.show(slug);
          setFormData({
            name: profile.name ?? "",
            color: profile.color ?? "",
            notes: Array.isArray(profile.notes) ? profile.notes.join(", ") : profile.notes ?? "",
            serving: profile.serving ?? "",
            grapes: Array.isArray(profile.grapes) ? profile.grapes : profile.grapes ? [profile.grapes] : [],
            regions: Array.isArray(profile.regions) ? profile.regions : profile.regions ? [profile.regions] : [],
            parameters: profile.parameters ?? {},
          });
          // Profiles store names, so negative IDs identify existing tags locally.
          // Newly selected catalogue entries retain their real positive IDs.
          setSelectedGrapes(
            (Array.isArray(profile.grapes) ? profile.grapes : profile.grapes ? [profile.grapes] : []).map((name, index) => ({ id: -(index + 1), name }))
          );
          setSelectedRegions(
            (Array.isArray(profile.regions) ? profile.regions : profile.regions ? [profile.regions] : []).map((name, index) => ({ id: -(index + 1), name }))
          );
          // Set taste scores
          setTasteScores(profile.parameters ?? {});
        } catch (err) {
          console.error(err);
          setError("Failed to load wine profile");
        }
      }

      // Fetch taste parameters
      try {
        const params = await tasteParametersApi.list();
        setTasteParams(params);
      } catch (err) {
        console.error(err);
        setError("Failed to load taste parameters");
      } finally {
        setLoading(false);
      }
    }

    initForm();
  }, [isEditing, slug]);

  // Handlers for grapes and regions
  const handleGrapeChange = (grapes: SelectedGrape[]) => {
    setSelectedGrapes(grapes);
    setFormData((prev) => ({ ...prev, grapes: grapes.map((g) => g.name) }));
  };

  const handleRegionChange = (regions: SelectedRegion[]) => {
    setSelectedRegions(regions);
    setFormData((prev) => ({ ...prev, regions: regions.map((r) => r.name) }));
  };

  const handleTasteChange = (slug: string, score: number) => {
    setTasteScores((prev) => ({
      ...prev,
      [slug]: score,
    }));
    setFormData((prev) => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [slug]: score,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isEditing && slug) {
        await wineProfilesApi.update(slug, formData as UserWineProfile);
        navigate(`/wine-profiles/${slug}`);
      } else {
        const created = await wineProfilesApi.create(formData as UserWineProfile);
        navigate(`/wine-profiles/${created.slug}`);
      }
    } catch (err) {
      console.error(err);
      setError(errorMessage(err, "Failed to save wine profile"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p>Loading…</p>;

  return (
    <div className="wine-app">
      {error && <p className="error" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} className="wine-form wine-profile-form">
        <div className="wine-form__header">
          <h2>{isEditing ? "Edit Wine Profile" : "Add Wine Profile"}</h2>
        </div>

        <div className="wine-form__section wine-profile-form__field-grid wine-profile-form__field-grid--identity">
          <label className="auth-form__field">
            <span>Name *</span>
            <input
              type="text"
              value={formData.name ?? ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </label>
          <label className="auth-form__field">
            <span>Color *</span>
            <input
              type="text"
              value={formData.color ?? ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
              required
              list="color-datalist"
            />
            <datalist id="color-datalist">
              <option value="Red" />
              <option value="White" />
              <option value="Rosé" />
              <option value="Sparkling" />
              <option value="Amber" />
              <option value="Orange" />
            </datalist>
          </label>
        </div>

        <div className="wine-form__section wine-profile-form__field-grid wine-profile-form__field-grid--description">
          <label className="auth-form__field wine-profile-form__notes-field">
            <span>Notes</span>
            <textarea
              value={formData.notes ?? ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              rows={4}
              placeholder="Describe the aroma, flavor, and finish..."
            />
          </label>
          <label className="auth-form__field">
            <span>Serving Suggestion</span>
            <input
              type="text"
              value={formData.serving ?? ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, serving: e.target.value }))}
              placeholder="e.g., Serve chilled at 8-10°C"
            />
          </label>
        </div>

        <div className="wine-form__section wine-profile-form__field-grid">
          <label className="auth-form__field">
            <span>Grapes</span>
            <GrapeSearch
              selected={selectedGrapes}
              onChange={handleGrapeChange}
            />
          </label>
          <label className="auth-form__field">
            <span>Regions</span>
            <RegionSearch
              selected={selectedRegions}
              onChange={handleRegionChange}
            />
          </label>
        </div>

        {tasteParams.length > 0 && (
          <TasteParameterSliders
            parameters={tasteParams}
            getScore={(parameter) => tasteScores[parameter.slug] ?? 3}
            onScoreChange={(parameter, _, score) =>
              handleTasteChange(parameter.slug, score)
            }
          />
        )}

        <div className="wine-form__actions">
          <button type="submit" className="auth-form__submit" disabled={submitting}>
            {submitting ? "Saving…" : isEditing ? "Update Profile" : "Create Profile"}
          </button>
          <Link
            to={isEditing ? `/wine-profiles/${slug}` : "/wine-profiles"}
            className="wine-form__cancel"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export default WineProfileForm;
