/** Format utilities for analytics and general use. */

/**
 * Format a number with locale-aware grouping (e.g., 1,234).
 * Falls back to plain number if Intl is unavailable.
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat().format(value);
  } catch {
    return String(value);
  }
}

/**
 * Format a number as a percentage with one decimal place (e.g., 12.3%).
 * Expects a decimal value (0.123 → "12.3%").
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${(value * 100).toFixed(1)}%`;
  }
}

/**
 * Format a date string (ISO) as a short localized date (e.g., "Jan 15, 2024").
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

/**
 * Format a date string (ISO) as a localized date and time (e.g., "Jan 15, 2024, 2:30 PM").
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}