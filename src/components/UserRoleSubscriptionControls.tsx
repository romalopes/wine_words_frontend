import type { ChangeEvent, MouseEvent } from "react";
import type { RoleOption } from "../types/user";
import type { Subscription } from "../types/subscription";

/**
 * Shared admin controls for a single user's roles and subscription — the
 * design/UI extracted from `UserRoles.tsx` so the list rows and the
 * `UserDetail` page render identical controls (was duplicated markup).
 *
 * Presentational only: each page keeps its own API-call logic (the list batches
 * per-row updates, the detail page refreshes a single user). All styling reuses
 * the existing `admin-user-*` classes in `index.css`.
 */
export interface UserRoleSubscriptionControlsProps {
  /** Role options rendered as checkboxes (from `GET /roles`). */
  roles: RoleOption[]
  /** Currently checked role ids, including pending (unsaved) toggles. */
  selectedRoleIds: Set<number>
  onToggleRole: (roleId: number, checked: boolean) => void
  onSaveRoles: () => void
  /** While true the Save button is disabled and labelled "Saving...". */
  savingRoles?: boolean | undefined
  /** Currently assigned subscription id, or null for none. */
  subscriptionId: number | null
  subscriptions: Subscription[]
  /** Receives null when the admin picks the "None" (unassign) option. */
  onSubscriptionChange: (subscriptionId: number | null) => void
  savingSubscription?: boolean | undefined
  /**
   * Own-admin guard: when true the Admin checkbox is disabled with the
   * "You cannot revoke your own Admin role" tooltip (no self-lockout).
   */
  isOwnAdminRole?: boolean | undefined
  /** Permission gate: non-admins get disabled controls and no action buttons. */
  isAdmin?: boolean | undefined
  /**
   * Renders the "Act as user" impersonation button when provided. The parent
   * owns the `window.confirm` + `startImpersonation` call (AuthContext lives
   * at page level); it decides visibility (admins only, target not Admin).
   */
  impersonationTarget?: { name: string; onActAsUser: () => void } | undefined
  /**
   * True inside `UserRoles`' clickable `<Link>` rows: every interactive
   * element stops event propagation so the row navigation never fires.
   */
  insideLink?: boolean | undefined
  /** Inline error row (`admin-user-error`), e.g. subscription failures. */
  error?: string | null | undefined
  /**
   * "row" (default): flat blocks matching the UserRoles list card.
   * "sections": the UserDetail page layout with Roles/Subscription headings.
   */
  layout?: "row" | "sections" | undefined
  /** Detail-page nicety: a "Current: X" line under the subscription select. */
  showCurrentSubscriptionHint?: boolean | undefined
  /** Subscription label for the current selection (for the hint). */
  currentSubscriptionName?: string | null | undefined
}

function UserRoleSubscriptionControls({
  roles,
  selectedRoleIds,
  onToggleRole,
  onSaveRoles,
  savingRoles = false,
  subscriptionId,
  subscriptions,
  onSubscriptionChange,
  savingSubscription = false,
  isOwnAdminRole = false,
  isAdmin = false,
  impersonationTarget,
  insideLink = false,
  error,
  layout = "row",
  showCurrentSubscriptionHint = false,
  currentSubscriptionName,
}: UserRoleSubscriptionControlsProps) {
  // Wrap a handler so that (inside Link rows) the click never navigates.
  const guarded =
    (handler: () => void) =>
    (event: MouseEvent<HTMLElement>) => {
      if (insideLink) event.stopPropagation();
      handler();
    };

  const roleCheckbox = (role: RoleOption) => {
    const ownAdminDisabled = isOwnAdminRole && role.name === "Admin";
    // Disabled inputs never fire change events, so no extra guard is needed.
    const disabled = !isAdmin || ownAdminDisabled || savingRoles;
    const title = ownAdminDisabled
      ? "You cannot revoke your own Admin role"
      : !isAdmin
        ? "Only admins can change roles"
        : undefined;
    return (
      <label
        key={role.id}
        className="role-check"
        title={title}
        // Inside Link rows, the click itself (not just change) must not
        // navigate — this covers clicks on the label text and the input.
        onClick={(e: MouseEvent<HTMLElement>) => {
          if (insideLink) e.stopPropagation();
        }}
      >
        <input
          type="checkbox"
          checked={selectedRoleIds.has(role.id)}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            if (insideLink) e.stopPropagation();
            onToggleRole(role.id, e.target.checked);
          }}
        />
        {role.name}
      </label>
    );
  };

  const handleSubscriptionSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    if (insideLink) event.stopPropagation();
    if (!isAdmin) return;
    onSubscriptionChange(event.target.value === "" ? null : Number(event.target.value));
  };

  const subscriptionBlock = (
    <div className="admin-user-subscription">
      {layout === "row" && "Subscription"}
      <select
        aria-label="Subscription"
        value={subscriptionId ?? ""}
        disabled={!isAdmin || savingSubscription}
        title={savingSubscription ? "Assigning…" : !isAdmin ? "Admin only" : undefined}
        onClick={(e: MouseEvent<HTMLElement>) => {
          if (insideLink) e.stopPropagation();
        }}
        onChange={handleSubscriptionSelect}
      >
        <option value="">None</option>
        {subscriptions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {showCurrentSubscriptionHint && currentSubscriptionName && (
        <span className="admin-user-email">Current: {currentSubscriptionName}</span>
      )}
    </div>
  );

  const rolesBlock = <div className="admin-user-roles">{roles.map(roleCheckbox)}</div>;

  const actionsBlock = isAdmin ? (
    <div className="admin-user-actions">
      <button
        type="button"
        className="admin-pagination__btn"
        disabled={savingRoles}
        onClick={guarded(onSaveRoles)}
      >
        {savingRoles ? "Saving..." : "Save roles"}
      </button>
      {impersonationTarget && (
        <button
          type="button"
          className="admin-pagination__btn"
          title={`Act as ${impersonationTarget.name}`}
          aria-label={`Act as ${impersonationTarget.name}`}
          onClick={guarded(impersonationTarget.onActAsUser)}
        >
          Act as user
        </button>
      )}
    </div>
  ) : null;

  const errorBlock = error ? (
    <div className="admin-user-error" role="alert">
      {error}
    </div>
  ) : null;

  if (layout === "sections") {
    return (
      <>
        <section>
          <h3>Roles</h3>
          {rolesBlock}
          {actionsBlock}
          {errorBlock}
        </section>
        <section>
          <h3>Subscription</h3>
          {subscriptionBlock}
        </section>
      </>
    );
  }

  return (
    <>
      {rolesBlock}
      {subscriptionBlock}
      {actionsBlock}
      {errorBlock}
    </>
  );
}

export default UserRoleSubscriptionControls;