import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { usersApi, producersApi, subscriptionsApi, countriesApi } from "../services/api";
import type { UserDetail as UserDetailType } from "../types/user";
import type { ProducerSearchResult, ProducerMembershipType } from "../types/producer";
import type { CountryListItem } from "../types/reference";
import type { Subscription } from "../types/subscription";
import { useAuth } from "../contexts/AuthContext";
import { USER_ROLE_OPTIONS, isAdmin, canManageUsers, PRODUCER_MEMBERSHIP_TYPES, producerMembershipLabel } from "../constants/roles";
import { errorMessage } from "../utils/errors";
import DetailHero from "./DetailHero";

interface PersonalInformationForm {
  first_name: string;
  last_name: string;
  phone: string;
  date_of_birth: string;
  address: {
    street_address: string;
    city: string;
    state: string;
    postal_code: string;
    country_id: string;
  };
}

const EMPTY_PERSONAL_INFORMATION: PersonalInformationForm = {
  first_name: "",
  last_name: "",
  phone: "",
  date_of_birth: "",
  address: {
    street_address: "",
    city: "",
    state: "",
    postal_code: "",
    country_id: "",
  },
};

function stringValue(value: unknown): string {
  return value == null ? "" : String(value);
}

function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser, startImpersonation } = useAuth();
  const [user, setUser] = useState<UserDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rolesLoading] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [producerResults, setProducerResults] = useState<ProducerSearchResult[]>([]);
  const [searchingProducers, setSearchingProducers] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [countries, setCountries] = useState<CountryListItem[]>([]);
  const [personalInformation, setPersonalInformation] =
    useState<PersonalInformationForm>(EMPTY_PERSONAL_INFORMATION);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDebounce, setSearchDebounce] = useState("");
  // Membership type applied when linking a producer (issue #191). Defaults to
  // manager: admins must make an explicit choice, and an accidental owner grant
  // is worse than an accidental manager one.
  const [newMembershipType, setNewMembershipType] = useState<ProducerMembershipType>("manager");
  
  // Track pending role changes (similar to UserRoles.tsx)
  const [selectedRoles, setSelectedRoles] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const isAdminUser = isAdmin(currentUser);
  const canManage = canManageUsers(currentUser);

  useEffect(() => {
    if (!id) return;
    const fetchUser = async () => {
      try {
        setLoading(true);
        const data = await usersApi.show(parseInt(id, 10));
        setUser(data);
        const account = data.account;
        setPersonalInformation({
          first_name: stringValue(account?.first_name ?? data.first_name),
          last_name: stringValue(account?.last_name ?? data.last_name),
          phone: stringValue(account?.phone),
          date_of_birth: stringValue(account?.date_of_birth),
          address: {
            street_address: stringValue(account?.address?.street_address),
            city: stringValue(account?.address?.city),
            state: stringValue(account?.address?.state),
            postal_code: stringValue(account?.address?.postal_code),
            country_id: stringValue(account?.address?.country_id),
          },
        });
        // Initialize selectedRoles with current user's roles
        setSelectedRoles(new Set(data.role_ids || []));
      } catch (err) {
        setError("Failed to load user details");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [id]);

  useEffect(() => {
    Promise.all([
      subscriptionsApi.list({ auth: true }).catch(() => []),
      countriesApi.list().catch(() => []),
    ]).then(([subscriptionList, countryList]) => {
      setSubscriptions(Array.isArray(subscriptionList) ? subscriptionList : []);
      setCountries(Array.isArray(countryList) ? countryList : []);
    });
  }, []);

  // Debounced server-side producer search for inline producer linking.
  // Searches the full producer catalog (GET /producers/search), excluding
  // producers already linked to this user at render time.
  useEffect(() => {
    const q = searchDebounce.trim();
    if (!q) {
      setProducerResults([]);
      return;
    }
    let cancelled = false;
    setSearchingProducers(true);
    producersApi
      .search(q)
      .then((data) => {
        if (!cancelled) setProducerResults(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setProducerResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearchingProducers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [searchDebounce]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleRoleChange = (roleId: number, checked: boolean) => {
    if (!user) return;
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (checked) next.add(roleId);
      else next.delete(roleId);
      return next;
    });
  };

  type PersonalField = Exclude<keyof PersonalInformationForm, "address">;
  type AddressField = keyof PersonalInformationForm["address"];

  const setPersonalField = (field: PersonalField, value: string) => {
    setPersonalInformation((previous) => ({ ...previous, [field]: value }));
  };

  const setAddressField = (field: AddressField, value: string) => {
    setPersonalInformation((previous) => ({
      ...previous,
      address: { ...previous.address, [field]: value },
    }));
  };

  const savePersonalInformation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    setProfileSaving(true);
    setProfileNotice(null);
    setProfileError(null);
    try {
      const account = await usersApi.updateAccount(user.id, {
        first_name: personalInformation.first_name || null,
        last_name: personalInformation.last_name || null,
        phone: personalInformation.phone || null,
        date_of_birth: personalInformation.date_of_birth || null,
        address: {
          street_address: personalInformation.address.street_address || null,
          city: personalInformation.address.city || null,
          state: personalInformation.address.state || null,
          postal_code: personalInformation.address.postal_code || null,
          country_id: personalInformation.address.country_id || null,
        },
      });
      setUser((previous) => previous ? {
        ...previous,
        account,
        first_name: account.first_name,
        last_name: account.last_name,
        display_name: [account.first_name, account.last_name].filter(Boolean).join(" "),
      } : null);
      setProfileNotice("Personal information updated.");
    } catch (err) {
      setProfileError(errorMessage(err, "Failed to update personal information"));
    } finally {
      setProfileSaving(false);
    }
  };

  const saveRoles = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const roleIds = Array.from(selectedRoles);
      const updated = await usersApi.assignRoles(user.id, roleIds);
      setUser((prev) => (prev ? { ...prev, role_ids: updated.role_ids, roles: updated.roles } : null));
      // Update selectedRoles to match the saved roles
      setSelectedRoles(new Set(updated.role_ids || []));
    } catch (err) {
      setError(errorMessage(err, "Failed to save roles"));
    } finally {
      setSaving(false);
    }
  };

  const handleSubscriptionChange = async (subscriptionId: number | null) => {
    if (!user) return;
    setSubscriptionLoading(true);
    try {
      const updated = await usersApi.assignSubscription(user.id, subscriptionId);
      setUser((prev) => (prev ? { ...prev, subscription: updated.subscription } : null));
    } catch (err) {
      console.error("Failed to update subscription:", err);
      alert("Failed to update subscription");
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleAddMembership = async (producerId: number) => {
    if (!user) return;
    setMembershipsLoading(true);
    try {
      const membership = await usersApi.producerMemberships.create(
        user.id,
        producerId,
        newMembershipType,
      );
      setUser((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          producer_memberships: [...prev.producer_memberships, membership],
        };
      });
      setSearchQuery("");
      setSearchDebounce("");
      setProducerResults([]);
    } catch (err) {
      console.error("Failed to add producer membership:", err);
      alert("Failed to link producer");
    } finally {
      setMembershipsLoading(false);
    }
  };

  // Change an existing membership type without touching global roles or the
  // subscription (issue #191). The API rejects follower/viewer values.
  const handleMembershipTypeChange = async (
    membershipId: number,
    membershipType: ProducerMembershipType,
  ) => {
    if (!user) return;
    setMembershipsLoading(true);
    try {
      const updated = await usersApi.producerMemberships.update(
        user.id,
        membershipId,
        membershipType,
      );
      setUser((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          producer_memberships: prev.producer_memberships.map((membership) =>
            membership.id === membershipId
              ? { ...membership, membership_type: updated.membership_type }
              : membership,
          ),
        };
      });
    } catch (err) {
      console.error("Failed to change producer membership type:", err);
      alert("Failed to change membership type");
    } finally {
      setMembershipsLoading(false);
    }
  };

  const handleRemoveMembership = async (membershipId: number) => {
    if (!user) return;
    if (!window.confirm("Are you sure you want to unlink this producer?")) return;
    setMembershipsLoading(true);
    try {
      await usersApi.producerMemberships.destroy(user.id, membershipId);
      setUser((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          producer_memberships: prev.producer_memberships.filter((m) => m.id !== membershipId),
        };
      });
    } catch (err) {
      console.error("Failed to remove producer membership:", err);
      alert("Failed to unlink producer");
    } finally {
      setMembershipsLoading(false);
    }
  };

  if (loading) return <div className="page-container">Loading...</div>;
  if (error || !user) return <div className="page-container">User not found</div>;

  const linkedProducerIds = new Set(user.producer_memberships.map((m) => m.producer.id));
  const filteredProducers = producerResults.filter((p) => !linkedProducerIds.has(p.id));

  return (
    <div className="page-container">
      <Link to="/users" className="wine-detail__back">
        &larr; Back to Users
      </Link>
      <DetailHero
        kicker="People"
        title={user.display_name || user.email}
        intro={`Email: ${user.email}`}
      />
      <div className="card">
        <div className="card-body">
          {isAdminUser && (
            <section className="account-card user-detail__personal-information">
              <form className="auth-form" onSubmit={savePersonalInformation}>
                <h2 className="account-card__title">Personal information</h2>
                <p className="account-card__lede">
                  Update the account holder&apos;s profile and postal address.
                </p>
                {profileNotice && <p className="review-form__success">{profileNotice}</p>}
                {profileError && <p className="review-form__error">{profileError}</p>}
                <div className="account-fields">
                  <label className="auth-form__field">
                    <span>First name</span>
                    <input
                      type="text"
                      required
                      maxLength={80}
                      value={personalInformation.first_name}
                      onChange={(event) => setPersonalField("first_name", event.target.value)}
                    />
                  </label>
                  <label className="auth-form__field">
                    <span>Last name</span>
                    <input
                      type="text"
                      required
                      maxLength={80}
                      value={personalInformation.last_name}
                      onChange={(event) => setPersonalField("last_name", event.target.value)}
                    />
                  </label>
                  <label className="auth-form__field">
                    <span>Phone</span>
                    <input
                      type="tel"
                      maxLength={40}
                      value={personalInformation.phone}
                      onChange={(event) => setPersonalField("phone", event.target.value)}
                    />
                  </label>
                  <label className="auth-form__field">
                    <span>Date of birth</span>
                    <input
                      type="date"
                      value={personalInformation.date_of_birth}
                      onChange={(event) => setPersonalField("date_of_birth", event.target.value)}
                    />
                  </label>
                </div>
                <h3 className="account-section-title">Address</h3>
                <div className="account-fields">
                  <label className="auth-form__field account-fields--wide">
                    <span>Street</span>
                    <input
                      type="text"
                      maxLength={200}
                      value={personalInformation.address.street_address}
                      onChange={(event) => setAddressField("street_address", event.target.value)}
                    />
                  </label>
                  <label className="auth-form__field">
                    <span>City</span>
                    <input
                      type="text"
                      maxLength={200}
                      value={personalInformation.address.city}
                      onChange={(event) => setAddressField("city", event.target.value)}
                    />
                  </label>
                  <label className="auth-form__field">
                    <span>State</span>
                    <input
                      type="text"
                      maxLength={200}
                      value={personalInformation.address.state}
                      onChange={(event) => setAddressField("state", event.target.value)}
                    />
                  </label>
                  <label className="auth-form__field">
                    <span>Postal code</span>
                    <input
                      type="text"
                      maxLength={200}
                      value={personalInformation.address.postal_code}
                      onChange={(event) => setAddressField("postal_code", event.target.value)}
                    />
                  </label>
                  <label className="auth-form__field">
                    <span>Country</span>
                    <select
                      value={personalInformation.address.country_id}
                      onChange={(event) => setAddressField("country_id", event.target.value)}
                    >
                      <option value="">— Select country —</option>
                      {countries.map((country) => (
                        <option key={country.id} value={country.id}>{country.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <button className="auth-form__submit" type="submit" disabled={profileSaving}>
                  {profileSaving ? "Saving…" : "Save personal information"}
                </button>
              </form>
            </section>
          )}
          <div className="grid grid-2">
            {isAdminUser && (
              <section>
                <h3>Roles</h3>
                <div className="admin-user-roles">
                  {USER_ROLE_OPTIONS.map((role) => {
                    const disabled = isAdminUser && user.id === currentUser?.id && role.name === "Admin";
                    return (
                      <label key={role.id} className="role-check" title={disabled ? "You cannot revoke your own Admin role" : undefined}>
                        <input
                          type="checkbox"
                          checked={selectedRoles.has(role.id)}
                          onChange={(e) => handleRoleChange(role.id, e.target.checked)}
                          disabled={rolesLoading || disabled || saving}
                        />
                        {role.name}
                      </label>
                    );
                  })}
                </div>
                <div className="admin-user-actions">
                  <button
                    type="button"
                    className="admin-pagination__btn"
                    disabled={saving}
                    onClick={saveRoles}
                  >
                    {saving ? "Saving..." : "Save roles"}
                  </button>
                  {!user.roles?.includes("Admin") && (
                    <button
                      type="button"
                      className="admin-pagination__btn"
                      title={`Act as ${user.display_name || user.email}`}
                      aria-label={`Act as ${user.display_name || user.email}`}
                      onClick={() => {
                        if (window.confirm(`Act as ${user.display_name || user.email}? You will operate as this user until you stop.`)) {
                          startImpersonation(user.id).catch((err) => setError(err.message || "Failed to start impersonation"));
                        }
                      }}
                    >
                      Act as user
                    </button>
                  )}
                </div>
              </section>
            )}
            {isAdminUser && (
              <section>
                <h3>Subscription</h3>
                <select
                  value={user.subscription?.id || ""}
                  onChange={(e) => handleSubscriptionChange(e.target.value ? parseInt(e.target.value, 10) : null)}
                  disabled={subscriptionLoading}
                  className="form-select"
                >
                  <option value="">None</option>
                  {subscriptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {user.subscription && (
                  <p className="text-muted mt-1">Current: {user.subscription.name}</p>
                )}
              </section>
            )}
          </div>
          {canManage && (
            <section className="mt-4">
              <h3>Producer Memberships</h3>
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Search producers to link…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ maxWidth: "400px" }}
                />
                <label className="membership-type-field" htmlFor="new-membership-type">
                  <span>Membership type</span>
                  <select
                    id="new-membership-type"
                    className="form-select"
                    value={newMembershipType}
                    onChange={(e) =>
                      setNewMembershipType(e.target.value as ProducerMembershipType)
                    }
                    disabled={membershipsLoading}
                  >
                    {PRODUCER_MEMBERSHIP_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {producerMembershipLabel(type)}
                      </option>
                    ))}
                  </select>
                </label>
                {searchDebounce.trim() && searchingProducers && <p className="text-muted mt-1">Searching…</p>}
              </div>
              {searchDebounce.trim() && !searchingProducers && filteredProducers.length > 0 && (
                <div className="producer-search-results mb-3" style={{ maxHeight: "200px", overflow: "auto" }}>
                  {filteredProducers.map((producer) => (
                    <button
                      key={producer.id}
                      className="producer-search-item"
                      onClick={() => handleAddMembership(producer.id)}
                      disabled={membershipsLoading}
                    >
                      {producer.name} — {producer.country?.name || "No country"}
                    </button>
                  ))}
                </div>
              )}
              {searchDebounce.trim() && !searchingProducers && filteredProducers.length === 0 && (
                <p className="text-muted mb-3">No matching producers found.</p>
              )}
              {user.producer_memberships.length === 0 ? (
                <p className="text-muted">No producers linked yet.</p>
              ) : (
                <ul className="membership-list">
                  {user.producer_memberships.map((membership) => (
                    <li key={membership.id} className="membership-item">
                      <div className="membership-info">
                        <strong>
                          <Link to={`/producers/${membership.producer.slug}`}>
                            {membership.producer.name}
                          </Link>
                        </strong>
                        <span className="text-muted">({membership.producer.country || "No country"})</span>
                        <span
                          className={`membership-badge membership-badge--${membership.membership_type}`}
                        >
                          {producerMembershipLabel(membership.membership_type)}
                        </span>
                        {membership.created_by && (
                          <span className="text-muted">
                            Linked by {membership.created_by.display_name}
                          </span>
                        )}
                      </div>
                      <label className="membership-type-field">
                        <span>Type</span>
                        <select
                          className="form-select membership-type-select"
                          aria-label={`Membership type for ${membership.producer.name}`}
                          value={membership.membership_type}
                          onChange={(e) =>
                            handleMembershipTypeChange(
                              membership.id,
                              e.target.value as ProducerMembershipType,
                            )
                          }
                          disabled={membershipsLoading}
                        >
                          {PRODUCER_MEMBERSHIP_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {producerMembershipLabel(type)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRemoveMembership(membership.id)}
                        disabled={membershipsLoading}
                      >
                        Unlink
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserDetail;