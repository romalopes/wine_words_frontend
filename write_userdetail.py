
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { usersApi, accountApi } from "../services/api";
import type { UserDetail } from "../types/user";
import type { ProducerSummary } from "../types/producer";
import { USER_ROLE_OPTIONS } from "../constants/roles";

function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [availableProducers, setAvailableProducers] = useState<ProducerSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDebounce, setSearchDebounce] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProducerId, setSelectedProducerId] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchUser = async () => {
      try {
        setLoading(true);
        const data = await usersApi.show(parseInt(id, 10));
        setUser(data);
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
    const fetchProducers = async () => {
      try {
        const data = await accountApi.myProducers();
        setAvailableProducers(data);
      } catch (err) {
        console.error("Failed to load producers:", err);
      }
    };
    fetchProducers();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleRoleChange = async (roleId: number, checked: boolean) => {
    if (!user) return;
    const newRoleIds = checked
      ? [...user.role_ids, roleId]
      : user.role_ids.filter((r) => r !== roleId);
    setRolesLoading(true);
    try {
      const updated = await usersApi.assignRoles(user.id, newRoleIds);
      setUser((prev) => (prev ? { ...prev, role_ids: updated.role_ids, roles: updated.roles } : null));
    } catch (err) {
      console.error("Failed to update roles:", err);
      alert("Failed to update roles");
    } finally {
      setRolesLoading(false);
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

  const handleAddMembership = async () => {
    if (!user || !selectedProducerId) return;
    setMembershipsLoading(true);
    try {
      const membership = await usersApi.producerMemberships.create(user.id, selectedProducerId);
      setUser((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          producer_memberships: [...prev.producer_memberships, membership],
        };
      });
      setShowAddModal(false);
      setSelectedProducerId(null);
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

  const filteredProducers = availableProducers.filter(
    (p) =>
      p.name.toLowerCase().includes(searchDebounce.toLowerCase()) &&
      !user.producer_memberships.some((m) => m.producer.id === p.id)
  );

  return (
    <div className="page-container">
      <div className="card">
        <div className="card-header">
          <h2>{user.display_name || user.email}</h2>
          <p className="text-muted">{user.email}</p>
        </div>
        <div className="card-body">
          <div className="grid grid-2">
            <section>
              <h3>Roles</h3>
              <div className="role-checkboxes">
                {USER_ROLE_OPTIONS.map((role) => (
                  <label key={role.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={user.role_ids.includes(role.id)}
                      onChange={(e) => handleRoleChange(role.id, e.target.checked)}
                      disabled={rolesLoading}
                    />
                    <span>{role.name}</span>
                  </label>
                ))}
              </div>
            </section>
            <section>
              <h3>Subscription</h3>
              <select
                value={user.subscription?.id || ""}
                onChange={(e) => handleSubscriptionChange(e.target.value ? parseInt(e.target.value, 10) : null)}
                disabled={subscriptionLoading}
                className="form-select"
              >
                <option value="">None</option>
                {user.subscription && (
                  <option value={user.subscription.id} selected>
                    {user.subscription.name} (current)
                  </option>
                )}
              </select>
              {user.subscription && (
                <p className="text-muted mt-1">Current: {user.subscription.name}</p>
              )}
            </section>
          </div>
          <section className="mt-4">
            <h3>Producer Memberships</h3>
            <div className="flex justify-between items-center mb-2">
              <span>{user.producer_memberships.length} linked producer(s)</span>
              <button
                className="btn btn-primary"
                onClick={() => setShowAddModal(true)}
                disabled={membershipsLoading}
              >
                Link Producer
              </button>
            </div>
            {user.producer_memberships.length === 0 ? (
              <p className="text-muted">No producers linked yet.</p>
            ) : (
              <ul className="membership-list">
                {user.producer_memberships.map((membership) => (
                  <li key={membership.id} className="membership-item">
                    <div>
                      <strong>{membership.producer.name}</strong>
                      <span className="text-muted ml-2">({membership.producer.country || "No country"})</span>
                      {membership.created_by && (
                        <span className="text-muted ml-2">
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
        </div>
      </div>
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Link Producer</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                placeholder="Search producers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input mb-2"
              />
              <div className="producer-search-results">
                {filteredProducers.length === 0 ? (
                  <p className="text-muted">No matching producers found.</p>
                ) : (
                  filteredProducers.map((producer) => (
                    <button
                      key={producer.id}
                      className="producer-search-item"
                      onClick={() => setSelectedProducerId(producer.id)}
                    >
                      {producer.name} — {producer.country || "No country"}
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddMembership}
                disabled={!selectedProducerId || membershipsLoading}
              >
                Link Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserDetail;
