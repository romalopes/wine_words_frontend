import { useState, useEffect, type ChangeEvent } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { producersApi, imagesApi, countriesApi } from "../services/api";
import GrapeSearch, { type SelectedGrape } from "./GrapeSearch";
import RegionSearch, { type SelectedRegion } from "./RegionSearch";
import { errorMessage, errorText } from "../utils/errors";
import type { CountryListItem } from "../types/reference";

/**
 * `RegionSearch` carries only id/name, but this form also keeps each region's
 * country so that changing the producer's country can drop the regions that no
 * longer belong to it (see `handleCountryChange`).
 *
 * `| undefined` is accepted on the nested country fields so a value read off an
 * optional API field assigns directly — same convention as `RegionPathCrumb`.
 */
type SelectedProducerRegion = SelectedRegion & {
  country?:
    | { id?: number | null | undefined; name?: string | null | undefined }
    | null
    | undefined;
};

/** `GrapeSearch` carries only id/name; the form preserves the colour too. */
type SelectedProducerGrape = SelectedGrape & {
  color?: string | null | undefined;
};

/**
 * The nested mailing address. Every text field is a controlled string, so the
 * numeric ids stay as strings too and are converted on submit.
 */
interface ProducerFormAddress {
  id: number | null;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  country_id: string;
}

interface ProducerFormData {
  name: string;
  legal_name: string;
  email: string;
  producer_type: string;
  website: string;
  instagram: string;
  facebook: string;
  description: string;
  phone: string;
  founded_year: string;
  active: boolean;
  country_id: string;
  address: ProducerFormAddress;
}

const EMPTY_ADDRESS: ProducerFormAddress = {
  id: null,
  street_address: "",
  city: "",
  state: "",
  postal_code: "",
  country_id: "",
};

function ProducerForm() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(slug);
  // `show`/`update` need a non-null id; the edit branch is the only caller, and
  // it only runs when `slug` is present.
  const producerSlug = slug ?? "";
  const [images, setImages] = useState<FileList | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [countries, setCountries] = useState<CountryListItem[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<
    SelectedProducerRegion[]
  >([]);
  const [selectedGrapes, setSelectedGrapes] = useState<SelectedProducerGrape[]>(
    [],
  );

  const [formData, setFormData] = useState<ProducerFormData>({
    name: "",
    legal_name: "",
    email: "",
    producer_type: "winery",
    website: "",
    instagram: "",
    facebook: "",
    description: "",
    phone: "",
    founded_year: "",
    active: true,
    country_id: "",
    // Mailing address lives in its own record (producer has_one :address).
    address: { ...EMPTY_ADDRESS },
  });
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    countriesApi
      .list()
      .then((data) => {
        const list = (Array.isArray(data) ? data : []).filter(
          (c) => c.is_wine_country,
        );
        setCountries(list);
        // Default the selections to Australia when nothing is selected yet.
        setFormData((prev) => {
          const australia = list.find((c) => c.code === "AU");
          const next = { ...prev };
          if (!prev.country_id && australia) {
            next.country_id = String(australia.id);
          }
          if (!prev.address.country_id && australia) {
            next.address = {
              ...prev.address,
              country_id: String(australia.id),
            };
          }
          return next;
        });
      })
      .catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    async function initFormData() {
      if (isEditing) {
        try {
          setLoading(true);
          const data = await producersApi.show(producerSlug);
          setFormData({
            name: data.name || "",
            legal_name: data.legal_name || "",
            email: data.email || "",
            producer_type: data.producer_type || "winery",
            website: data.website || "",
            instagram: data.instagram || "",
            facebook: data.facebook || "",
            description: data.description || "",
            phone: data.phone || "",
            founded_year:
              data.founded_year != null ? String(data.founded_year) : "",
            active: data.active !== false,
            country_id: data.country?.id ? String(data.country.id) : "",
            address: {
              id: data.address?.id ?? null,
              street_address: data.address?.street_address || "",
              city: data.address?.city || "",
              state: data.address?.state || "",
              postal_code: data.address?.postal_code || "",
              country_id: data.address?.country?.id
                ? String(data.address.country.id)
                : "",
            },
          });
          setExistingLogoUrl(data.logo_url || null);
          setSelectedRegions(
            (data.regions || []).map((r) => ({
              id: r.id,
              name: r.name,
              country: { id: data.country?.id, name: data.country?.name },
            })),
          );
          setSelectedGrapes(
            (data.grapes || []).map((g) => ({
              id: g.id,
              name: g.name,
              color: g.color,
            })),
          );
        } catch (err) {
          setError(errorMessage(err, "Failed to load producer"));
        } finally {
          setLoading(false);
        }
      }
    }
    initFormData();
    // `producerSlug` is derived from `slug` (`slug ?? ""`), so listing both
    // changes nothing at runtime — it just satisfies the exhaustive-deps rule
    // now that the fetch calls through the derived variable.
  }, [producerSlug, isEditing]);

  function handleChange(
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, type, value } = e.target;
    // Only checkboxes expose `checked`; text fields and selects always use
    // `value`.
    const checked =
      e.target instanceof HTMLInputElement && type === "checkbox"
        ? e.target.checked
        : value;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  // Address fields live in the nested formData.address object.
  function handleAddressChange(
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      address: { ...prev.address, [name]: value },
    }));
  }

  // Changing the country invalidates regions outside it — drop them.
  function handleCountryChange(e: ChangeEvent<HTMLSelectElement>) {
    const countryId = e.target.value;
    setFormData((prev) => ({ ...prev, country_id: countryId }));
    setSelectedRegions((prev) =>
      prev.filter(
        (r) => r.country && String(r.country.id) === String(countryId),
      ),
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        name: formData.name,
        legal_name: formData.legal_name || null,
        email: formData.email || null,
        producer_type: formData.producer_type || null,
        website: formData.website || null,
        instagram: formData.instagram || null,
        facebook: formData.facebook || null,
        description: formData.description || null,
        phone: formData.phone || null,
        founded_year: formData.founded_year || null,
        active: formData.active,
        country_id: formData.country_id || null,
        region_ids: selectedRegions.map((r) => r.id),
        grape_ids: selectedGrapes.map((g) => g.id),
        address_attributes: {
          id: formData.address.id || undefined,
          street_address: formData.address.street_address || null,
          city: formData.address.city || null,
          state: formData.address.state || null,
          postal_code: formData.address.postal_code || null,
          country_id: formData.address.country_id || null,
        },
      };

      let result;
      if (isEditing) {
        result = await producersApi.update(producerSlug, payload);
        if (images && images.length > 0) {
          await imagesApi.upload("producer", producerSlug, images);
        }
      } else {
        result = await producersApi.create(payload);
        if (images && images.length > 0) {
          await imagesApi.upload("producer", result.slug, images);
        }
      }

      // On edit, keep the slug we were already on; a create returns its own.
      const producerId = result.slug || producerSlug;
      if (logoFile) {
        await producersApi.uploadLogo(producerId, logoFile);
      } else if (logoRemoved) {
        await producersApi.removeLogo(producerId);
      }

      navigate(`/producers/${producerId}`, { replace: true });
    } catch (err) {
      setError(errorText(err) || errorMessage(err, "Failed to save producer"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="wine-app">
        <p className="wine-management__loading">Loading…</p>
      </div>
    );
  }

  return (
    <div className="wine-app">
      <Link
        to={isEditing ? `/producers/${slug}` : "/producers"}
        className="wine-detail__back"
      >
        &larr; Back
      </Link>
      <div className="wine-management__header">
        <h1>{isEditing ? "Edit Producer" : "Add New Producer"}</h1>
      </div>
      {error && <p className="auth-form__error">{error}</p>}
      <form onSubmit={handleSubmit} className="wine-form producer-form">
        <div className="wine-form__fields producer-form__fields">
          <label className="auth-form__field">
            <span>Name *</span>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g. Château Margaux"
            />
          </label>
          <label className="auth-form__field">
            <span>Legal name</span>
            <input
              type="text"
              name="legal_name"
              value={formData.legal_name}
              onChange={handleChange}
              placeholder="Legal corporate name (if different)"
            />
          </label>
          <label className="auth-form__field">
            <span>Street address</span>
            <input
              type="text"
              name="street_address"
              value={formData.address.street_address}
              onChange={handleAddressChange}
              placeholder="e.g. 123 Vine St, Bordeaux"
            />
          </label>
          <label className="auth-form__field">
            <span>City</span>
            <input
              type="text"
              name="city"
              value={formData.address.city}
              onChange={handleAddressChange}
            />
          </label>
          <label className="auth-form__field">
            <span>State</span>
            <input
              type="text"
              name="state"
              value={formData.address.state}
              onChange={handleAddressChange}
            />
          </label>
          <label className="auth-form__field">
            <span>Postal code</span>
            <input
              type="text"
              name="postal_code"
              value={formData.address.postal_code}
              onChange={handleAddressChange}
            />
          </label>
          <label className="auth-form__field">
            <span>Address country</span>
            <select
              name="country_id"
              value={formData.address.country_id}
              onChange={handleAddressChange}
            >
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.flag_emoji ? `${country.flag_emoji} ` : ""}
                  {country.name}
                </option>
              ))}
            </select>
          </label>
          <label className="auth-form__field">
            <span>Country</span>
            <select
              name="country_id"
              value={formData.country_id}
              onChange={handleCountryChange}
              required
            >
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.flag_emoji ? `${country.flag_emoji} ` : ""}
                  {country.name}
                </option>
              ))}
            </select>
          </label>
          <label className="auth-form__field">
            <span>Phone</span>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="e.g. +61 2 9999 9999"
            />
          </label>
          <label className="auth-form__field">
            <span>Founded year</span>
            <input
              type="number"
              name="founded_year"
              min={1}
              max={new Date().getFullYear()}
              value={formData.founded_year}
              onChange={handleChange}
              placeholder="e.g. 1858"
            />
          </label>
          <label className="auth-form__field">
            <span>Email *</span>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="e.g. contact@producer.com"
            />
          </label>
          <label className="auth-form__field">
            <span>Producer Type *</span>
            <select
              name="producer_type"
              value={formData.producer_type}
              onChange={handleChange}
              required
            >
              <option value="winery">Winery</option>
              <option value="negociant">Negociant</option>
              <option value="cooperative">Cooperative</option>
              <option value="wine_company">Wine Company</option>
              <option value="independent_producer">Independent Producer</option>
            </select>
          </label>
          <label className="auth-form__field">
            <span>Website</span>
            <input
              type="url"
              name="website"
              value={formData.website}
              onChange={handleChange}
              placeholder="https://producer.com"
            />
          </label>
          <label className="auth-form__field">
            <span>Instagram</span>
            <input
              type="text"
              name="instagram"
              value={formData.instagram}
              onChange={handleChange}
              placeholder="@handle or full URL"
            />
          </label>
          <label className="auth-form__field">
            <span>Facebook</span>
            <input
              type="text"
              name="facebook"
              value={formData.facebook}
              onChange={handleChange}
              placeholder="Page name or full URL"
            />
          </label>
          <label className="auth-form__field auth-form__field--checkbox producer-form__active">
            <input
              type="checkbox"
              name="active"
              checked={formData.active}
              onChange={handleChange}
            />
            <span>Active</span>
          </label>
          <label className="auth-form__field producer-form__field--wide">
            <span>Description</span>
            <textarea
              name="description"
              rows={4}
              value={formData.description}
              onChange={handleChange}
              placeholder="About this producer…"
            />
          </label>
        </div>

        <div className="auth-form__field producer-form__field--wide">
          <span>Logo</span>
          {existingLogoUrl && !logoRemoved && !logoFile && (
            <div style={{ marginBottom: 8 }}>
              <img
                src={existingLogoUrl}
                alt="Producer logo"
                style={{ maxWidth: 120, display: "block" }}
              />
              <button
                type="button"
                className="wine-form__remove-vintage"
                onClick={() => setLogoRemoved(true)}
              >
                Remove logo
              </button>
            </div>
          )}
          {logoRemoved && (
            <p style={{ margin: "4px 0" }}>
              <em>Logo will be removed when you save.</em>{" "}
              <button
                type="button"
                className="wine-form__remove-vintage"
                onClick={() => setLogoRemoved(false)}
              >
                Undo
              </button>
            </p>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
          />
          <small>PNG, JPEG, GIF, WEBP or SVG — max 10 MB.</small>
        </div>

        <div className="auth-form__field producer-form__field--wide">
          <RegionSearch
            selected={selectedRegions}
            onChange={setSelectedRegions}
            countryId={
              formData.country_id ? Number(formData.country_id) : null
            }
          />
        </div>

        <div className="auth-form__field producer-form__field--wide">
          <GrapeSearch
            selected={selectedGrapes}
            onChange={setSelectedGrapes}
          />
        </div>

        <label className="auth-form__field producer-form__field--wide">
          <span>Images (you can select several)</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setImages(e.target.files)}
          />
        </label>

        <div className="wine-form__actions">
          <button
            type="submit"
            className="auth-form__submit"
            disabled={submitting}
          >
            {submitting
              ? "Saving…"
              : isEditing
                ? "Update Producer"
                : "Create Producer"}
          </button>
          <Link
            to={isEditing ? `/producers/${slug}` : "/producers"}
            className="wine-form__cancel"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export default ProducerForm;
