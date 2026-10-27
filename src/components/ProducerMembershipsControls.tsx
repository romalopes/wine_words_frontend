import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import type {
  ProducerSearchResult,
  ProducerMembershipType,
} from "../types/producer";
import type { ProducerMembership } from "../types/user";
import {
  PRODUCER_MEMBERSHIP_TYPES,
  producerMembershipLabel,
} from "../constants/roles";

export interface ProducerMembershipsControlsProps {
  memberships: ProducerMembership[];
  loading: boolean;
  newMembershipType: ProducerMembershipType;
  onChangeNewMembershipType: (type: ProducerMembershipType) => void;
  searchQuery: string;
  onSearchQuery: (query: string) => void;
  searching: boolean;
  searchResults: ProducerSearchResult[];
  onAddMembership: (producerId: number) => void;
  onMembershipTypeChange: (
    membershipId: number,
    type: ProducerMembershipType,
  ) => void;
  onRemoveMembership: (membershipId: number) => void;
  /**
   * Override the body of a linked-list row. Defaults to the producer-centric
   * layout used on the user detail page. Supply a user-centric layout (or a
   * different identity shape) to reuse these controls on the producer detail
   * page — the linking/unlink/type-change shell stays identical.
   */
  renderMember?: (membership: ProducerMembership) => ReactElement;
}

/**
 * Reusable "link producers to an entity" control: search field + membership
 * type selector, filtered result buttons, and the list of existing producer
 * memberships with type-change + unlink actions. The only producer-specific
 * part is the default list-row layout (it links to `/producers/:slug`);
 * pass `renderMember` to adapt the row for a different identity shape, making
 * the entire linking shell reusable on the producer detail page.
 */
export default function ProducerMembershipsControls({
  memberships,
  loading,
  newMembershipType,
  onChangeNewMembershipType,
  searchQuery,
  onSearchQuery,
  searching,
  searchResults,
  onAddMembership,
  onMembershipTypeChange,
  onRemoveMembership,
  renderMember,
}: ProducerMembershipsControlsProps) {
  const defaultRenderMember = (membership: ProducerMembership) => (
    <>
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
      <label className="membership-type-field">
        <span>Type</span>
        <select
          className="form-select membership-type-select"
          aria-label={`Membership type for ${membership.producer.name}`}
          value={membership.membership_type}
          onChange={(e) =>
            onMembershipTypeChange(
              membership.id,
              e.target.value as ProducerMembershipType,
            )
          }
          disabled={loading}
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
        onClick={() => onRemoveMembership(membership.id)}
        disabled={loading}
      >
        Unlink
      </button>
    </>
  );

  return (
    <>
      <div className="membership-link-form">
        <div className="membership-link-form__intro">
          <span className="membership-link-form__icon" aria-hidden="true">
            +
          </span>
          <div>
            <h3>Add a producer</h3>
            <p>
              Search producers to grant this account access to. The access
              level you choose here is independent of the user&apos;s global
              role.
            </p>
          </div>
        </div>
        <div className="membership-link-form__controls">
          <div className="review-form__field membership-link-form__search">
            <label htmlFor="producer-search">Search producers</label>
            <div className="membership-link-form__search-control">
              <span aria-hidden="true">⌕</span>
              <input
                id="producer-search"
                type="search"
                aria-label="Search producers by name"
                value={searchQuery}
                onChange={(e) => onSearchQuery(e.target.value)}
                placeholder="Name…"
                autoComplete="off"
              />
            </div>
          </div>
          <label className="membership-type-field" htmlFor="new-membership-type">
            <span>Membership type</span>
            <select
              id="new-membership-type"
              className="form-select membership-type-select"
              aria-label="Membership type"
              value={newMembershipType}
              onChange={(e) =>
                onChangeNewMembershipType(
                  e.target.value as ProducerMembershipType,
                )
              }
              disabled={loading}
            >
              {PRODUCER_MEMBERSHIP_TYPES.map((type) => (
                <option key={type} value={type}>
                  {producerMembershipLabel(type)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {searchQuery.trim() && searching && (
          <p className="membership-link-form__status" role="status">
            Searching…
          </p>
        )}
        {searchQuery.trim() && !searching && searchResults.length > 0 && (
          <div
            className="producer-search-results mb-3"
            aria-label="Producer search results"
          >
            {searchResults.map((producer) => (
              <button
                key={producer.id}
                className="producer-search-item"
                onClick={() => onAddMembership(producer.id)}
                disabled={loading}
              >
                <span
                  className="producer-search-item__avatar"
                  aria-hidden="true"
                >
                  {(producer.name || "").charAt(0).toUpperCase() || "◎"}
                </span>
                <span className="producer-search-item__identity">
                  <strong>{producer.name}</strong>
                  <span className="text-muted">
                    {producer.country?.name || "No country"}
                  </span>
                </span>
                <span className="producer-search-item__action">
                  {loading ? "Linking…" : "Link producer"}
                </span>
              </button>
            ))}
          </div>
        )}
        {searchQuery.trim() && !searching && searchResults.length === 0 && (
          <p className="wine-management__empty-state">No matching producers.</p>
        )}
      </div>
      {loading ? (
        <p className="wine-management__loading">Loading linked producers…</p>
      ) : memberships.length === 0 ? (
        <div className="linked-users-empty">
          <span className="linked-users-empty__icon" aria-hidden="true">
            ◎
          </span>
          <div>
            <h3>No linked producers yet</h3>
            <p>Search above to give this account access to a producer.</p>
          </div>
        </div>
      ) : (
        <ul className="membership-list">
          {memberships.map((membership) => (
            <li key={membership.id} className="membership-item">
              {renderMember
                ? renderMember(membership)
                : defaultRenderMember(membership)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
