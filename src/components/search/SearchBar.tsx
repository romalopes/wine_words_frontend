import React from "react";
import styles from "./SearchBar.module.css";
import { SearchInput } from "./SearchInput";
import { ActiveFilters } from "./ActiveFilters";
import { SortDropdown } from "./SortDropdown";

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  activeFilters: Record<string, any>;
  /** Called with the key of an active-filter chip when its × is clicked. */
  onRemoveFilter: (key: string) => void;
  sortOptions: { value: string; label: string }[];
  currentSort: string;
  onSortChange: (value: string) => void;
  /**
   * Whether to render the sort dropdown. Hidden on /reviews and /articles for
   * now — the listings still sort by their default; flipping this back on
   * restores the control with no other changes.
   */
  showSort?: boolean;
  /** Whether to show the filter toggle button */
  showFilterButton?: boolean;
  /** Called when the filter toggle button is clicked */
  onFilterToggle?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = "Search...",
  onSearch,
  activeFilters,
  onRemoveFilter,
  sortOptions,
  currentSort,
  onSortChange,
  showSort = true,
  showFilterButton = false,
  onFilterToggle,
}) => {
  return (
    <div className={styles.container}>
      <SearchInput placeholder={placeholder} onChange={onSearch} />
      <div className={styles.controls}>
         <ActiveFilters
           filters={activeFilters}
           onRemoveFilter={onRemoveFilter}
         />
        {showSort && (
          <SortDropdown
            options={sortOptions}
            value={currentSort}
            onChange={onSortChange}
          />
        )}
        {showFilterButton && (
          <button
            type="button"
            className={styles.filterButton}
            onClick={onFilterToggle}
          >
            Filters
            {Object.keys(activeFilters).length > 0 && (
              <span className={styles.filterBadge}>
                {Object.keys(activeFilters).length}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
