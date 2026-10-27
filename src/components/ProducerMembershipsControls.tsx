import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { producersApi, usersApi } from "../services/api";
import {
  PRODUCER_MEMBERSHIP_TYPES,
  producerMembershipLabel,
} from "../constants/roles";
import type {
  ProducerMembershipType,
  ProducerSearchResult,
} from "../types/producer";
import type { AdminUser, ProducerMembership } from "../types/user";
import { responseItems } from "../types/common";
import { errorMessage, errorText } from "../utils/errors";

interface SharedProps {
  canManage: boolean;
}

interface UserMembershipsProps extends SharedProps {
  userId: number;
  initialMemberships: ProducerMembership[];
  producerId?: never;
}

interface ProducerMembershipsProps extends SharedProps {
  producerId: number;
  userId?: never;
  initialMemberships?: never;
}

export type ProducerMembershipsControlsProps =
  | UserMembershipsProps
  | ProducerMembershipsProps;

/**
 * Self-contained producer-membership manager. With `userId` it searches for
 * producers to link to that user. With `producerId` it searches for users and
 * loads/manages everyone linked to that producer.
 */
export default function ProducerMembershipsControls(
  props: ProducerMembershipsControlsProps,
) {
  const producerId = props.producerId;
  const userId = props.userId;
  const initialMemberships = props.initialMemberships;
  const producerMode = producerId !== undefined;
  const [memberships, setMemberships] = useState<ProducerMembership[]>(
    initialMemberships ?? [],
  );
  const [membershipsLoading, setMembershipsLoading] = useState(producerMode);
  const [searchQuery, setSearchQuery] = useState("");
  const [producerResults, setProducerResults] = useState<ProducerSearchResult[]>(
    [],
  );
  const [userResults, setUserResults] = useState<AdminUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [newMembershipType, setNewMembershipType] =
    useState<ProducerMembershipType>("manager");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [membershipError, setMembershipError] = useState<string | null>(null);

  useEffect(() => {
    if (!producerMode) {
      setMemberships(initialMemberships ?? []);
      setMembershipsLoading(false);
      return;
    }

    let cancelled = false;
    setMembershipsLoading(true);
    setMembershipError(null);
    producersApi
      .getMemberships(producerId)
      .then((data) => {
        if (!cancelled) setMemberships(data);
      })
      .catch((error) => {
        if (!cancelled) {
          setMemberships([]);
          setMembershipError(
            errorText(error) ??
              errorMessage(error, "Failed to load producer memberships"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setMembershipsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialMemberships, producerId, producerMode]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!props.canManage || !query) {
      setProducerResults([]);
      setUserResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      setMembershipError(null);
      const request = producerMode
        ? usersApi.search(query).then(responseItems)
        : producersApi.search(query);

      request
        .then((results) => {
          if (cancelled) return;
          if (producerMode) {
            setUserResults(results as AdminUser[]);
          } else {
            setProducerResults(results as ProducerSearchResult[]);
          }
        })
        .catch((error) => {
          if (cancelled) return;
          setProducerResults([]);
          setUserResults([]);
          setMembershipError(
            errorText(error) ??
              errorMessage(
                error,
                producerMode
                  ? "Failed to search users"
                  : "Failed to search producers",
              ),
          );
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [producerMode, props.canManage, searchQuery]);

  const availableProducerResults = useMemo(() => {
    if (producerMode) return [];
    const linkedIds = new Set(
      memberships.map((membership) => membership.producer.id),
    );
    return producerResults.filter((producer) => !linkedIds.has(producer.id));
  }, [memberships, producerMode, producerResults]);

  const availableUserResults = useMemo(() => {
    if (!producerMode) return [];
    const linkedIds = new Set(
      memberships.flatMap((membership) =>
        membership.user ? [membership.user.id] : [],
      ),
    );
    return userResults.filter((result) => !linkedIds.has(result.id));
  }, [memberships, producerMode, userResults]);

  const busy = membershipsLoading || pendingId !== null;
  const hasQuery = searchQuery.trim().length > 0;

  async function addMembership(resultId: number) {
    setPendingId(resultId);
    setMembershipError(null);
    try {
      const membership = producerMode
        ? await usersApi.producerMemberships.create(
            resultId,
            producerId,
            newMembershipType,
          )
        : await usersApi.producerMemberships.create(
            userId!,
            resultId,
            newMembershipType,
          );
      setMemberships((current) => [...current, membership]);
      setSearchQuery("");
      setProducerResults([]);
      setUserResults([]);
    } catch (error) {
      setMembershipError(
        errorText(error) ??
          errorMessage(
            error,
            producerMode
              ? "Failed to link user to producer"
              : "Failed to link producer",
          ),
      );
    } finally {
      setPendingId(null);
    }
  }

  async function changeMembershipType(
    membership: ProducerMembership,
    membershipType: ProducerMembershipType,
  ) {
    const targetUserId = producerMode ? membership.user?.id : userId;
    if (targetUserId === undefined) {
      setMembershipError("This membership is missing its linked user.");
      return;
    }

    setPendingId(membership.id);
    setMembershipError(null);
    try {
      const updated = await usersApi.producerMemberships.update(
        targetUserId,
        membership.id,
        membershipType,
      );
      setMemberships((current) =>
        current.map((item) => (item.id === membership.id ? updated : item)),
      );
    } catch (error) {
      setMembershipError(
        errorText(error) ??
          errorMessage(error, "Failed to change membership type"),
      );
    } finally {
      setPendingId(null);
    }
  }

  async function removeMembership(membership: ProducerMembership) {
    const subject = producerMode ? "user" : "producer";
    const targetUserId = producerMode ? membership.user?.id : userId;
    if (targetUserId === undefined) {
      setMembershipError("This membership is missing its linked user.");
      return;
    }

    if (!window.confirm(`Are you sure you want to unlink this ${subject}?`)) {
      return;
    }

    setPendingId(membership.id);
    setMembershipError(null);
    try {
      await usersApi.producerMemberships.destroy(
        targetUserId,
        membership.id,
      );
      setMemberships((current) =>
        current.filter((item) => item.id !== membership.id),
      );
    } catch (error) {
      setMembershipError(
        errorText(error) ?? errorMessage(error, `Failed to unlink ${subject}`),
      );
    } finally {
      setPendingId(null);
    }
  }

  const searchResults = producerMode
    ? availableUserResults
    : availableProducerResults;

  const linkForm = props.canManage ? (
    <div className="membership-link-form">
      <div className="membership-link-form__intro">
        <span className="membership-link-form__icon" aria-hidden="true">
          +
        </span>
        <div>
          <h3>{producerMode ? "Add a user" : "Add a producer"}</h3>
          <p>
            {producerMode
              ? "Find an account and choose the access level they should receive."
              : "Search the producer catalogue and choose this account's access level. The access level you choose here is independent of the user's global role."}
          </p>
        </div>
      </div>
      <div className="membership-link-form__controls">
        <div className="review-form__field membership-link-form__search">
          <label htmlFor={producerMode ? "producer-user-search" : "producer-search"}>
            {producerMode ? "Search users" : "Search producers"}
          </label>
          <div className="membership-link-form__search-control">
            <span aria-hidden="true">⌕</span>
            <input
              id={producerMode ? "producer-user-search" : "producer-search"}
              type="search"
              aria-label={
                producerMode
                  ? "Search users by name or email"
                  : "Search producers by name"
              }
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={producerMode ? "Name or email address" : "Name…"}
              autoComplete="off"
            />
          </div>
        </div>
        <label
          className="membership-type-field"
          htmlFor={
            producerMode
              ? "producer-new-membership-type"
              : "new-membership-type"
          }
        >
          <span>{producerMode ? "Access level" : "Membership type"}</span>
          <select
            id={
              producerMode
                ? "producer-new-membership-type"
                : "new-membership-type"
            }
            className="form-select membership-type-select"
            aria-label="Membership type"
            value={newMembershipType}
            onChange={(event) =>
              setNewMembershipType(
                event.target.value as ProducerMembershipType,
              )
            }
            disabled={busy}
          >
            {PRODUCER_MEMBERSHIP_TYPES.map((type) => (
              <option key={type} value={type}>
                {producerMembershipLabel(type)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {membershipError && (
        <p className="review-form__error" role="alert">
          {membershipError}
        </p>
      )}
      {hasQuery && searching && (
        <p className="membership-link-form__status" role="status">
          {producerMode ? "Searching users…" : "Searching…"}
        </p>
      )}
      {hasQuery && !searching && searchResults.length > 0 && (
        <div
          className="producer-search-results mb-3"
          aria-label={
            producerMode ? "User search results" : "Producer search results"
          }
        >
          {producerMode
            ? availableUserResults.map((result) => {
                const name = result.display_name || result.email;
                return (
                  <button
                    key={result.id}
                    type="button"
                    className="producer-search-item"
                    onClick={() => void addMembership(result.id)}
                    disabled={busy}
                  >
                    <span
                      className="producer-search-item__avatar"
                      aria-hidden="true"
                    >
                      {name.charAt(0).toUpperCase() || "◎"}
                    </span>
                    <span className="producer-search-item__identity">
                      <strong>{name}</strong>
                      <span className="text-muted">{result.email}</span>
                    </span>
                    <span className="producer-search-item__action">
                      {pendingId === result.id ? "Linking…" : "Link user"}
                    </span>
                  </button>
                );
              })
            : availableProducerResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="producer-search-item"
                  onClick={() => void addMembership(result.id)}
                  disabled={busy}
                >
                  <span
                    className="producer-search-item__avatar"
                    aria-hidden="true"
                  >
                    {result.name.charAt(0).toUpperCase() || "◎"}
                  </span>
                  <span className="producer-search-item__identity">
                    <strong>{result.name}</strong>
                    <span className="text-muted">
                      {result.country?.name || "No country"}
                    </span>
                  </span>
                  <span className="producer-search-item__action">
                    {pendingId === result.id ? "Linking…" : "Link producer"}
                  </span>
                </button>
              ))}
        </div>
      )}
      {hasQuery &&
        !searching &&
        searchResults.length === 0 &&
        !membershipError && (
          <p className="wine-management__empty-state">
            {producerMode
              ? "No matching users found."
              : "No matching producers."}
          </p>
        )}
    </div>
  ) : (
    membershipError && (
      <p className="review-form__error" role="alert">
        {membershipError}
      </p>
    )
  );

  const membershipList = membershipsLoading ? (
    <p className="wine-management__loading">
      {producerMode
        ? "Loading linked users…"
        : "Loading linked producers…"}
    </p>
  ) : memberships.length === 0 ? (
    <div className="linked-users-empty">
      <span className="linked-users-empty__icon" aria-hidden="true">
        ◎
      </span>
      <div>
        <h3>
          {producerMode ? "No linked users yet" : "No linked producers yet"}
        </h3>
        <p>
          {producerMode
            ? props.canManage
              ? "Search above to give someone access to this producer."
              : "No one has been assigned to this producer."
            : "Search above to give this account access to a producer."}
        </p>
      </div>
    </div>
  ) : producerMode ? (
    <ul className="linked-users-list">
      {memberships.map((membership) => {
        const linkedUser = membership.user;
        if (!linkedUser) return null;

        const name = linkedUser.display_name || linkedUser.email;
        return (
          <li key={membership.id} className="linked-user-item">
            <span className="linked-user-avatar" aria-hidden="true">
              {name.charAt(0).toUpperCase()}
            </span>
            <div className="linked-user-info">
              <strong>
                <Link to={`/users/${linkedUser.id}`}>{name}</Link>
              </strong>
              <span className="text-muted">{linkedUser.email}</span>
              {membership.created_by && (
                <span className="text-muted">
                  Linked by {membership.created_by.display_name}
                </span>
              )}
            </div>
            <span
              className={`membership-badge membership-badge--${membership.membership_type}`}
            >
              {producerMembershipLabel(membership.membership_type)}
            </span>
            {props.canManage && (
              <div className="membership-actions">
                <button
                  type="button"
                  onClick={() => void removeMembership(membership)}
                  className="review-form__status-btn unlink-btn"
                  disabled={busy}
                >
                  Unlink
                </button>
                <select
                  value={membership.membership_type}
                  onChange={(event) =>
                    void changeMembershipType(
                      membership,
                      event.target.value as ProducerMembershipType,
                    )
                  }
                  className="membership-type-select"
                  aria-label={`Membership type for ${name}`}
                  disabled={busy}
                >
                  {PRODUCER_MEMBERSHIP_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {producerMembershipLabel(type)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  ) : (
    <ul className="membership-list">
      {memberships.map((membership) => (
        <li key={membership.id} className="membership-item">
          <div className="membership-info">
            <strong>
              <Link to={`/producers/${membership.producer.slug}`}>
                {membership.producer.name}
              </Link>
            </strong>
            <span className="text-muted">
              ({membership.producer.country || "No country"})
            </span>
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
          {props.canManage && (
            <>
              <label className="membership-type-field">
                <span>Type</span>
                <select
                  className="form-select membership-type-select"
                  aria-label={`Membership type for ${membership.producer.name}`}
                  value={membership.membership_type}
                  onChange={(event) =>
                    void changeMembershipType(
                      membership,
                      event.target.value as ProducerMembershipType,
                    )
                  }
                  disabled={busy}
                >
                  {PRODUCER_MEMBERSHIP_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {producerMembershipLabel(type)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => void removeMembership(membership)}
                disabled={busy}
              >
                Unlink
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  );

  if (!producerMode) {
    return (
      <>
        {linkForm}
        {membershipList}
      </>
    );
  }

  return (
    <div className="wine-detail__section linked-users-section">
      <div className="linked-users-section__header">
        <div>
          <h2>Linked Users</h2>
          <p>Manage who can represent and contribute to this producer.</p>
        </div>
        <span
          className="linked-users-section__count"
          aria-label={`${memberships.length} linked users`}
        >
          {memberships.length}
        </span>
      </div>
      {linkForm}
      {membershipList}
    </div>
  );
}
