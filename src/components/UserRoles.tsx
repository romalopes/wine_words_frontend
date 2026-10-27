import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import DetailHero from "./DetailHero";
import { usersApi, subscriptionsApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { isAdmin, canManageUsers } from "../constants/roles";
import { errorMessage } from "../utils/errors";
import UserRoleSubscriptionControls from "./UserRoleSubscriptionControls";
import type { AdminUser, AdminUserResults, RoleOption } from "../types/user";
import type { Subscription } from "../types/subscription";

function UserRoles() {
  const { user, startImpersonation } = useAuth();
  const isAdminUser = isAdmin(user);
  const canManage = canManageUsers(user);

  const [allRoles, setAllRoles] = useState<RoleOption[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUserResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<number, Set<number>>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [savingSub, setSavingSub] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    usersApi
      .roles()
      .then((data) => setAllRoles(Array.isArray(data) ? data : []));
    subscriptionsApi
      .list({ auth: true })
      .then((data) => setSubscriptions(Array.isArray(data) ? data : []));
  }, []);

  async function runSearch(q: string, page = 1) {
    const trimmed = q.trim();
    try {
      setSearching(true);
      setError(null);
      const data = await usersApi.search(trimmed, page);
      if (Array.isArray(data)) {
        setResults({
          items: data,
          page: 1,
          per_page: data.length,
          total_count: data.length,
          total_pages: 1,
        });
      } else {
        setResults(data);
      }
    } catch (err) {
      setError(errorMessage(err, "Search failed"));
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    runSearch("");
  }, []);

  function handleSearchChange(e: ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(e.target.value, 1), 300);
  }

  function goToPage(page: number) {
    runSearch(query, page);
  }

  function updateItem(userId: number, patch: Partial<AdminUser>) {
    setResults((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((x) =>
              x.id === userId ? { ...x, ...patch } : x,
            ),
          }
        : prev,
    );
  }

  function toggleRole(u: AdminUser, roleId: number, checked: boolean) {
    const next = new Set(selected[u.id] || u.role_ids || []);
    if (checked) next.add(roleId);
    else next.delete(roleId);
    setSelected((prev) => ({ ...prev, [u.id]: next }));
  }

  async function saveRoles(u: AdminUser) {
    setSaving(u.id);
    try {
      const roleIds = Array.from(selected[u.id] || []);
      const updated = await usersApi.assignRoles(u.id, roleIds);
      updateItem(u.id, { role_ids: updated.role_ids, roles: updated.roles });
      delete selected[u.id];
      setSelected({ ...selected });
    } catch (err) {
      setError(errorMessage(err, "Failed to save roles"));
    } finally {
      setSaving(null);
    }
  }

  async function changeSubscription(u: AdminUser, subscriptionId: number | null) {
    setSavingSub(u.id);
    try {
      const updated = await usersApi.assignSubscription(u.id, subscriptionId);
      updateItem(u.id, { subscription: updated.subscription });
    } catch (err) {
      setError(errorMessage(err, "Failed to assign subscription"));
    } finally {
      setSavingSub(null);
    }
  }

  if (!isAdminUser) {
    return (
      <main className="wine-app">
        <Link to="/" className="wine-detail__back">
          &larr; Back to Dashboard
        </Link>
        <DetailHero
          kicker="Admin"
          title="User Management"
          intro="Access denied. Admin role required."
        />
      </main>
    );
  }

  return (
    <main className="wine-app">
      {!canManage && (
        <DetailHero
          kicker="Admin"
          title="User Management"
          intro="You don't have permission to access user management."
        />
      )}
      {canManage && (
        <>
          <Link to="/" className="wine-detail__back">
            &larr; Back to Dashboard
          </Link>
          <DetailHero
            kicker="Admin"
            title="Users"
            intro="Search and manage users, roles, and subscriptions"
          />

          <div className="admin-user-search">
            <input
              type="search"
              placeholder="Search users by name or email..."
              value={query}
              onChange={handleSearchChange}
              className="admin-user-search__input"
              aria-label="Search users"
            />
          </div>

          {error && <div className="admin-user-error">{error}</div>}

          {searching && <p className="wine-management__loading">Searching…</p>}
          {results && results.items.length === 0 && (
            <p className="wine-management__empty-state">No users found.</p>
          )}

          <div className="admin-users">
            {results?.items.map((u) => {
              const isOwnAdminRole =
                u.roles?.includes("Admin") && u.id === user?.id;
              return (
                <Link
                  key={u.id}
                  to={`/users/${u.id}`}
                  className="admin-user-card"
                >
                  <div className="admin-user-info">
                    <span
                      className="admin-user-name"
                      title={u.display_name || u.email}
                    >
                      {u.display_name || u.email}
                    </span>
                    <span className="admin-user-email" title={u.email}>
                      {u.email}
                    </span>
                  </div>
                  <UserRoleSubscriptionControls
                    roles={allRoles}
                    selectedRoleIds={selected[u.id] ?? new Set(u.role_ids || [])}
                    onToggleRole={(roleId, checked) => toggleRole(u, roleId, checked)}
                    onSaveRoles={() => saveRoles(u)}
                    savingRoles={saving === u.id}
                    subscriptionId={u.subscription?.id ?? null}
                    subscriptions={subscriptions}
                    onSubscriptionChange={(subscriptionId) =>
                      changeSubscription(u, subscriptionId)
                    }
                    savingSubscription={savingSub === u.id}
                    isOwnAdminRole={isOwnAdminRole}
                    isAdmin={isAdminUser}
                    impersonationTarget={
                      isAdminUser && !u.roles?.includes("Admin")
                        ? {
                            name: u.display_name || u.email,
                            onActAsUser: () => {
                              if (
                                window.confirm(
                                  `Act as ${u.display_name || u.email}? You will operate as this user until you stop.`,
                                )
                              ) {
                                startImpersonation(u.id).catch((err) =>
                                  setError(
                                    err.message || "Failed to start impersonation",
                                  ),
                                );
                              }
                            },
                          }
                        : undefined
                    }
                    insideLink
                  />
                </Link>
              );
            })}
          </div>

          {results && results.total_pages > 1 && (
            <div className="admin-pagination">
              <button
                type="button"
                className="admin-pagination__btn"
                disabled={searching || results.page <= 1}
                onClick={() => goToPage(results.page - 1)}
              >
                ← Previous
              </button>
              <span>
                Page {results.page} of {results.total_pages}{" "}
                {typeof results.total_count === "number" &&
                  ` (${results.total_count} users)`}
              </span>
              <button
                type="button"
                className="admin-pagination__btn"
                disabled={searching || results.page >= results.total_pages}
                onClick={() => goToPage(results.page + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
export default UserRoles;
