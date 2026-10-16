/**
 * Simple pill‑style component used to show the currently selected wine
 * category with a clickable close button.  It is intentionally lightweight
 * and relies on global CSS defined in `index.css`.
 */
export interface CategoryChipProps {
  /** The label to display inside the chip. */
  label: string;
  /** Called when the user clicks the × button. */
  onClear: () => void;
}

export function CategoryChip({ label, onClear }: CategoryChipProps) {
  return (
    <span className="category-chip">{label}
      <button
        type="button"
        className="category-chip__remove"
        aria-label={`Clear category ${label}`}
        onClick={onClear}
      >
        ×
      </button>
    </span>
  );
}
