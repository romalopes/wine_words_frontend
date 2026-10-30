import React from 'react';
import styles from './SortDropdown.module.css';

interface SortDropdownProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

export const SortDropdown: React.FC<SortDropdownProps> = ({
  options,
  value,
  onChange,
}) => {
  return (
    <select
      aria-label="Sort results"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={styles.select}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};