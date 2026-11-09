import type { ViewMode } from "../../types/common";
import styles from "./ViewModeToggle.module.css";

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  /** Names the control for assistive tech, e.g. "Wine profile view". */
  ariaLabel?: string;
}

const OPTIONS: Array<{ value: ViewMode; label: string }> = [
  { value: "cards", label: "Cards" },
  { value: "list", label: "List" },
];

/**
 * Cards / List switch shared by every listing page. One mode is active at a
 * time; the buttons expose it through `aria-pressed` so the current view is
 * announced rather than only implied by colour.
 */
export default function ViewModeToggle({
  value,
  onChange,
  ariaLabel = "View mode",
}: ViewModeToggleProps) {
  return (
    <div className={styles.viewToggle} role="group" aria-label={ariaLabel}>
      <span className={styles.viewToggleLabel}>View</span>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`${styles.viewToggleButton} ${
            value === option.value ? styles.viewToggleButtonActive : ""
          }`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
