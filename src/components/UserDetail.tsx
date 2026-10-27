import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  usersApi,
  producersApi,
  subscriptionsApi,
  countriesApi,
} from "../services/api";
import type { UserDetail as UserDetailType } from "../types/user";
import type {
  ProducerSearchResult,
  ProducerMembershipType,
} from "../types/producer";
import type { CountryListItem } from "../types/reference";
import type { Subscription } from "../types/subscription";
import ProducerMembershipsControls from "./ProducerMembershipsControls";
import AccountLifecycleControls from "./AccountLifecycleControls";
import PersonalInformationControls from "./PersonalInformationControls";
import type {
  PersonalInformationForm,
  PersonalField,
  PersonalAddressField,
} from "../types/personalInformation";
import { EMPTY_PERSONAL_INFORMATION } from "../types/personalInformation";
import { useAuth } from "../contexts/AuthContext";
import {
  isAdmin,
  canManageUsers,
  USER_ROLE_OPTIONS,
} from "../constants/roles";
import type { RoleOption } from "../types/user";
import UserRoleSubscriptionControls from "./UserRoleSubscriptionControls";
import { errorMessage, errorText, errorData } from "../utils/errors";
import DetailHero from "./DetailHero";

function stringValue(value: unknown): string {
  return value == null ? "" : String(value);
}

function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser, startImpersonation } = useAuth();
  const [user, setUser] = useState<UserDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rolesLoading] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [producerResults, setProducerResults] = useState<
    ProducerSearchResult[]
  >([]);
  const [searchingProducers, setSearchingProducers] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [countries, setCountries] = useState<CountryListItem[]>([]);
  // Role options for the shared admin controls; seeded with the constant list
  // and replaced by the server's role list once fetched.
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([
    ...USER_ROLE_OPTIONS,
  ]);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(
    null,
  );
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
  const [newMembershipType, setNewMembershipType] =
    useState<ProducerMembershipType>("manager");

  // Track pending role changes (similar to UserRoles.tsx)
  const [selectedRoles, setSelectedRoles] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  // Account lifecycle (soft / hard delete). The confirmation modal lives
  // inside <AccountLifecycleControls />; these states drive its content.
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  /** Structured reasons returned by a 409 "blocked" hard-delete response. */
  const [blockingReasons, setBlockingReasons] = useState<
    Array<{ code: string; message: string }>
  >([]);

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
      // Optional-call: keeps working even where the API client is stubbed.
      Promise.resolve(usersApi.roles?.() ?? []).catch(() => []),
    ]).then(([subscriptionList, countryList, roleList]) => {
      setSubscriptions(Array.isArray(subscriptionList) ? subscriptionList : []);
      setCountries(Array.isArray(countryList) ? countryList : []);
      if (Array.isArray(roleList) && roleList.length > 0) {
        setRoleOptions(roleList as RoleOption[]);
      }
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

  type AddressField = PersonalAddressField;

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
      setUser((previous) =>
        previous
          ? {
              ...previous,
              account,
              first_name: account.first_name,
              last_name: account.last_name,
              display_name: [account.first_name, account.last_name]
                .filter(Boolean)
                .join(" "),
            }
          : null,
      );
      setProfileNotice("Personal information updated.");
    } catch (err) {
      setProfileError(
        errorMessage(err, "Failed to update personal information"),
      );
    } finally {
      setProfileSaving(false);
    }
  };

  // ---- Account lifecycle handlers ----

  const handleSoftDelete = async () => {
    if (!user) return;
    setDeleteLoading(true);
    setDeleteError(null);
    setBlockingReasons([]);
    try {
      await usersApi.softDelete(user.id);
      // Refresh so the lifecycle section flips to the reactivate state.
      setUser(await usersApi.show(user.id));
    } catch (err: unknown) {
      setDeleteError(errorText(err) ?? "Failed to soft delete user");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleHardDelete = async () => {
    if (!user) return;
    setDeleteLoading(true);
    setDeleteError(null);
    setBlockingReasons([]);
    try {
      await usersApi.hardDelete(user.id);
      // The record is gone — return to the admin user list.
      navigate("/users");
    } catch (err: unknown) {
      setDeleteError(errorText(err) ?? "Failed to hard delete user");
      const reasons = errorData(err).blocking_reasons;
      if (Array.isArray(reasons)) {
        setBlockingReasons(
          reasons.filter(
            (r): r is { code: string; message: string } =>
              r !== null &&
              typeof r === "object" &&
              typeof (r as { message?: unknown }).message === "string" &&
              typeof (r as { code?: unknown }).code === "string",
          ),
        );
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!user) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await usersApi.reactivate(user.id);
      setUser(await usersApi.show(user.id));
    } catch (err: unknown) {
      setDeleteError(errorText(err) ?? "Failed to reactivate user");
    } finally {
      setDeleteLoading(false);
    }
  };

  const saveRoles = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const roleIds = Array.from(selectedRoles);
      const updated = await usersApi.assignRoles(user.id, roleIds);
      setUser((prev) =>
        prev
          ? { ...prev, role_ids: updated.role_ids, roles: updated.roles }
          : null,
      );
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
    setSubscriptionError(null);
    try {
      const updated = await usersApi.assignSubscription(
        user.id,
        subscriptionId,
      );
      setUser((prev) =>
        prev ? { ...prev, subscription: updated.subscription } : null,
      );
    } catch (err) {
      setSubscriptionError(errorText(err) ?? "Failed to update subscription");
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
    if (!window.confirm("Are you sure you want to unlink this producer?"))
      return;
    setMembershipsLoading(true);
    try {
      await usersApi.producerMemberships.destroy(user.id, membershipId);
      setUser((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          producer_memberships: prev.producer_memberships.filter(
            (m) => m.id !== membershipId,
          ),
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
  if (error || !user)
    return <div className="page-container">User not found</div>;

  const linkedProducerIds = new Set(
    user.producer_memberships.map((m) => m.producer.id),
  );
  const filteredProducers = producerResults.filter(
    (p) => !linkedProducerIds.has(p.id),
  );

  return (
    <>
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
              <PersonalInformationControls
                className="user-detail__personal-information"
                value={personalInformation}
                onChangeField={setPersonalField}
                onChangeAddressField={setAddressField}
                countries={countries}
                onSubmit={savePersonalInformation}
                saving={profileSaving}
                notice={profileNotice ?? undefined}
                error={profileError ?? undefined}
                lede="Update the account holder's profile and postal address."
              />
            )}
            <div className="grid grid-2">
              {isAdminUser && (
                <UserRoleSubscriptionControls
                  layout="sections"
                  roles={roleOptions}
                  selectedRoleIds={selectedRoles}
                  onToggleRole={handleRoleChange}
                  onSaveRoles={saveRoles}
                  savingRoles={saving || rolesLoading}
                  subscriptionId={user.subscription?.id ?? null}
                  subscriptions={subscriptions}
                  onSubscriptionChange={handleSubscriptionChange}
                  savingSubscription={subscriptionLoading}
                  isOwnAdminRole={
                    user.id === currentUser?.id && user.roles?.includes("Admin")
                  }
                  isAdmin={isAdminUser}
                  impersonationTarget={
                    user.roles?.includes("Admin")
                      ? undefined
                      : {
                          name: user.display_name || user.email,
                          onActAsUser: () => {
                            if (
                              window.confirm(
                                `Act as ${user.display_name || user.email}? You will operate as this user until you stop.`,
                              )
                            ) {
                              startImpersonation(user.id).catch((err) =>
                                setError(
                                  err.message ||
                                    "Failed to start impersonation",
                                ),
                              );
                            }
                          },
                        }
                  }
                  error={subscriptionError}
                  showCurrentSubscriptionHint
                  currentSubscriptionName={user.subscription?.name ?? null}
                />
              )}
            </div>
            {canManage && (
              <section className="mt-4">
                <h3>Producer Memberships</h3>
                <ProducerMembershipsControls
                  memberships={user.producer_memberships}
                  loading={membershipsLoading}
                  newMembershipType={newMembershipType}
                  onChangeNewMembershipType={setNewMembershipType}
                  searchQuery={searchQuery}
                  onSearchQuery={setSearchQuery}
                  searching={searchingProducers}
                  searchResults={filteredProducers}
                  onAddMembership={handleAddMembership}
                  onMembershipTypeChange={handleMembershipTypeChange}
                  onRemoveMembership={handleRemoveMembership}
                />
              </section>
            )}
            {isAdminUser && (
              <AccountLifecycleControls
                account={user}
                loading={deleteLoading}
                error={deleteError}
                blockingReasons={blockingReasons}
                onSoftDelete={handleSoftDelete}
                onHardDelete={handleHardDelete}
                onReactivate={handleReactivate}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default UserDetail;
