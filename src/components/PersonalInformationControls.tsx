import type { FormEvent, ReactNode } from "react";
import type { CountryListItem } from "../types/reference";
import type {
  PersonalInformationForm,
  PersonalField,
  PersonalAddressField,
} from "../types/personalInformation";

interface FieldProps {
  label: string;
  children: ReactNode;
  /** Stretches the field across both columns of the profile grid. */
  wide?: boolean;
}

function Field({ label, children, wide }: FieldProps) {
  return (
    <label className={`auth-form__field${wide ? " account-fields--wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export interface PersonalInformationControlsProps {
  /** Current form values. */
  value: PersonalInformationForm;
  onChangeField: (field: PersonalField, value: string) => void;
  onChangeAddressField: (field: PersonalAddressField, value: string) => void;
  countries: CountryListItem[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving?: boolean;
  notice?: string | undefined;
  error?: string | undefined;
  /** Card heading (h2). */
  title?: string;
  /** Optional lede paragraph under the heading. */
  lede?: string | undefined;
  /** Render the "Personal information" section heading before the fields
   * (used by AccountSettings, where the card is titled "Profile"). */
  showSectionHeading?: boolean;
  submitLabel?: string;
  /** Extra classes appended to the `account-card` section wrapper. */
  className?: string;
}

/**
 * Reusable personal-information (profile + postal address) form, shared by
 * AccountSettings (self-service profile) and UserDetail (admin editing of a
 * user's account). The parent owns the form state and the save request; this
 * component only renders fields and emits changes.
 */
export default function PersonalInformationControls({
  value,
  onChangeField,
  onChangeAddressField,
  countries,
  onSubmit,
  saving = false,
  notice,
  error,
  title = "Personal information",
  lede,
  showSectionHeading = false,
  submitLabel = "Save personal information",
  className,
}: PersonalInformationControlsProps) {
  return (
    <section
      className={className ? `account-card ${className}` : "account-card"}
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <h2 className="account-card__title">{title}</h2>
        {lede && <p className="account-card__lede">{lede}</p>}
        {notice && <p className="review-form__success">{notice}</p>}
        {error && <p className="review-form__error">{error}</p>}
        {showSectionHeading && (
          <h3 className="account-section-title account-section-title--first">
            Personal information
          </h3>
        )}
        <div className="account-fields">
          <Field label="First name">
            <input
              type="text"
              autoComplete="given-name"
              required
              maxLength={80}
              value={value.first_name}
              onChange={(e) => onChangeField("first_name", e.target.value)}
            />
          </Field>
          <Field label="Last name">
            <input
              type="text"
              autoComplete="family-name"
              required
              maxLength={80}
              value={value.last_name}
              onChange={(e) => onChangeField("last_name", e.target.value)}
            />
          </Field>
          <Field label="Phone">
            <input
              type="tel"
              maxLength={40}
              value={value.phone}
              onChange={(e) => onChangeField("phone", e.target.value)}
            />
          </Field>
          <Field label="Date of birth">
            <input
              type="date"
              value={value.date_of_birth}
              onChange={(e) => onChangeField("date_of_birth", e.target.value)}
            />
          </Field>
        </div>
        <h3 className="account-section-title">Address</h3>
        <div className="account-fields">
          <Field label="Street" wide>
            <input
              type="text"
              maxLength={200}
              value={value.address.street_address}
              onChange={(e) =>
                onChangeAddressField("street_address", e.target.value)
              }
            />
          </Field>
          <Field label="City">
            <input
              type="text"
              maxLength={200}
              value={value.address.city}
              onChange={(e) => onChangeAddressField("city", e.target.value)}
            />
          </Field>
          <Field label="State">
            <input
              type="text"
              maxLength={200}
              value={value.address.state}
              onChange={(e) => onChangeAddressField("state", e.target.value)}
            />
          </Field>
          <Field label="Postal code">
            <input
              type="text"
              maxLength={200}
              value={value.address.postal_code}
              onChange={(e) =>
                onChangeAddressField("postal_code", e.target.value)
              }
            />
          </Field>
          <Field label="Country">
            <select
              value={value.address.country_id}
              onChange={(e) =>
                onChangeAddressField("country_id", e.target.value)
              }
            >
              <option value="">— Select country —</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <button className="auth-form__submit" type="submit" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </button>
      </form>
    </section>
  );
}