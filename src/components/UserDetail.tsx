import { useEffect, useState, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { usersApi, producersApi, subscriptionsApi } from "../services/api";
import type { UserDetail as UserDetailType } from "../types/user";
import type { ProducerSearchResult } from "../types/producer";
import type { Subscription } from "../types/subscription";
import { useAuth } from "../contexts/AuthContext";
import { USER_ROLE_OPTIONS, isAdmin, canManageUsers } from "../constants/roles";
import { errorMessage } from "../utils/errors";
import DetailHero from "./DetailHero";

function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser, startImpersonation } = useAuth();
  const [user, setUser] = useState<UserDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [producerResults, setProducerResults] = useState<ProducerSearchResult[]>([]);
  const [searchingProducers, setSearchingProducers] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDebounce, setSearchDebounce] = useState("");
  
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
    subscriptionsApi
      .list({ auth: true })
      .then((data) => setSubscriptions(Array.isArray(data) ? data : []))
      .catch(() => setSubscriptions([]));
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
      const membership = await usersApi.producerMemberships.create(user.id, producerId);
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
                        <span className="text-muted">({membership.producer.country?.name || "No country"})</span>
                        {membership.created_by && (
                          <span className="text-muted">
                            Linked by {membership.created_by.display_name}
                          </span>
                        )}
                      </div>
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