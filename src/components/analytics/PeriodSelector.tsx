import React from "react";

export const PeriodSelector: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ value, onChange, options }) => (
  <div className="period-selector">
    <select value={value} onChange={(e) => onChange(e.target.value)} className="period-select" aria-label="Reporting period">
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);