import { canManageWinesRole } from "../constants/roles";
import type { RoleUser } from "../constants/roles";

/** The three lifecycle states shared by reviews and articles. */
export type ContentStatus = "draft" | "published" | "archived";

interface ContentStatusActionsProps {
  /** Current status of the item; its button is shown active/disabled. */
  status: string;
  /** Called with the requested status when a different button is clicked. */
  onChange: (status: ContentStatus) => void;
  /** Signed-in user — the whole control is hidden unless they are a manager. */
  user?: RoleUser | null;
  /** Disables every button while a transition is in flight. */
  busy?: boolean;
}

const OPTIONS: Array<{ value: ContentStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Publish" },
  { value: "archived", label: "Archive" },
];

/**
 * Draft / Publish / Archive control shown on review and article detail pages.
 * Only Reviewers, Editors and Admins see it; the item's current status is
 * rendered as an active, disabled button so the group reads as a state toggle.
 */
function ContentStatusActions({ status, onChange, user, busy }: ContentStatusActionsProps) {
  if (!canManageWinesRole(user)) return null;

  return (
    <div className="content-status" role="group" aria-label="Content status">
      {OPTIONS.map((option) => {
        const active = status === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={`content-status__btn${active ? " content-status__btn--active" : ""}`}
            aria-pressed={active}
            aria-label={`Set status to ${option.label}`}
            disabled={busy || active}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default ContentStatusActions;
