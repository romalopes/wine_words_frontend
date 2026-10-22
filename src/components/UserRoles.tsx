import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { usersApi, subscriptionsApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { isAdmin, canManageUsers } from "../constants/roles";
import { errorMessage } from "../utils/errors";
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
    usersApi.roles().then((data) => setAllRoles(Array.isArray(data) ? data : []));
    subscriptionsApi.list({ auth: true }).then((data) => setSubscriptions(Array.isArray(data) ? data : []));
  }, []);

  async function runSearch(q: string, page = 1) {
    const trimmed = q.trim();
    try {
      setSearching(true);
      setError(null);
      const data = await usersApi.search(trimmed, page);
      if (Array.isArray(data)) {
        setResults({ items: data, page: 1, per_page: data.length, total_count: data.length, total_pages: 1 });
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

  useEffect(() => { runSearch(""); }, []);

  function handleSearchChange(e: ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(e.target.value, 1), 300);
  }

  function goToPage(page: number) { runSearch(query, page); }

  function updateItem(userId: number, patch: Partial<AdminUser>) {
    setResults((prev) => prev ? { ...prev, items: prev.items.map((x) => (x.id === userId ? { ...x, ...patch } : x)) } : prev);
  }

  function hasRole(u: AdminUser, roleId: number) {
    const pending = selected[u.id];
    if (pending) return pending.has(roleId);
    return (u.role_ids || []).includes(roleId);
  }

  function toggleRole(u: AdminUser, roleId: number, checked: boolean) {
    const next = new Set(selected[u.id] || u.role_ids || []);
    if (checked) next.add(roleId); else next.delete(roleId);
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
    } finally { setSaving(null); }
  }

  async function changeSubscription(u: AdminUser, subscriptionId: number) {
    setSavingSub(u.id);
    try {
      const updated = await usersApi.assignSubscription(u.id, subscriptionId || null);
      updateItem(u.id, { subscription: updated.subscription });
    } catch (err) { setError(errorMessage(err, "Failed to assign subscription")); }
    finally { setSavingSub(null); }
  }

  if (!isAdminUser) {
    return (
      <main className="wine-app">
        <div className="auth-card">
          <h1>Access denied</h1>
          <p>Admin access required.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="wine-app">
      {(!canManage) && (
        <div className="wine-management__header">
          <h1>User Management</h1>
          <p className="text-muted">You don't have permission to access user management.</p>
        </div>
      )}
      {canManage && (
        <>
          <div className="wine-management__header">
            <h1>Users</h1>
            <p className="review-card__comment">Search and manage users, roles, and subscriptions</p>
          </div>

          <div className="admin-user-search">
            <input type="search" placeholder="Search users by name or email..." value={query} onChange={handleSearchChange} className="admin-user-search__input" aria-label="Search users" />
          </div>

          {error && <div className="admin-user-error">{error}</div>}

          {searching && <p className="wine-management__loading">Searching…</p>}
          {results && results.items.length === 0 && (
            <p className="wine-management__empty-state">No users found.</p>
          )}

          <div className="admin-users">
            {results?.items.map((u) => {
              const isOwnAdminRole = u.roles?.includes("Admin") && u.id === user?.id;
              return (
                <Link key={u.id} to={`/users/${u.id}`} className="admin-user-card">
                  <div className="admin-user-info">
                    <span className="admin-user-name" title={u.display_name || u.email}>
                      {u.display_name || u.email}
                    </span>
                    <span className="admin-user-email" title={u.email}>{u.email}</span>
                  </div>
                  <div className="admin-user-roles">
                    {allRoles.map((role) => {
                      const disabled = isOwnAdminRole && role.name === "Admin";
                      const editorDisabled = !isAdminUser || disabled;
                      return (
                        <label key={role.id} className="role-check" title={disabled ? "You cannot revoke your own Admin role" : !isAdminUser ? "Only admins can change roles" : undefined}>
                          <input type="checkbox" checked={hasRole(u, role.id)} disabled={editorDisabled} onChange={(e) => { e.stopPropagation(); if (!editorDisabled) toggleRole(u, role.id, e.target.checked); }} />
                          {role.name}
                        </label>
                      );
                    })}
                  </div>
                  <div className="admin-user-subscription">
                    Subscription
                    <select value={u.subscription?.id ?? ""} disabled={savingSub === u.id || !isAdminUser} onChange={(e) => { e.stopPropagation(); if (isAdminUser) changeSubscription(u, Number(e.target.value)); }}>
                      <option value="" disabled>{savingSub === u.id ? "Assigning..." : isAdminUser ? "Select" : "Admin only"}</option>
                      {subscriptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="admin-user-actions">
                    {isAdminUser && (
                      <button type="button" className="admin-pagination__btn" disabled={saving === u.id} onClick={(e) => { e.stopPropagation(); saveRoles(u); }}>
                        {saving === u.id ? "Saving..." : "Save roles"}
                      </button>
                    )}
                    {isAdminUser && !u.roles?.includes("Admin") && (
                      <button type="button" className="admin-pagination__btn" title={`Act as ${u.display_name || u.email}`} aria-label={`Act as ${u.display_name || u.email}`} onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Act as ${u.display_name || u.email}? You will operate as this user until you stop.`)) {
                          startImpersonation(u.id).catch((err) => setError(err.message || "Failed to start impersonation"));
                        }
                      }}>
                        Act as user
                      </button>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {results && results.total_pages > 1 && (
            <div className="admin-pagination">
              <button type="button" className="admin-pagination__btn" disabled={searching || results.page <= 1} onClick={() => goToPage(results.page - 1)}>← Previous</button>
              <span>Page {results.page} of {results.total_pages} {typeof results.total_count === "number" && ` (${results.total_count} users)`}</span>
              <button type="button" className="admin-pagination__btn" disabled={searching || results.page >= results.total_pages} onClick={() => goToPage(results.page + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
export default UserRoles;
