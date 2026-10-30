import {
  formatDate,
  formatDateTime,
  formatEngagementsPer100Views,
  formatNumber,
  formatPercent,
} from "./format";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockNumberFormatFailure() {
  vi.spyOn(Intl, "NumberFormat").mockImplementation(function NumberFormat() {
    throw new Error("Intl unavailable");
  });
}

describe("formatNumber", () => {
  it("formats finite values and rejects missing or invalid values", () => {
    expect(formatNumber(1234)).toBe(new Intl.NumberFormat().format(1234));
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
    expect(formatNumber(Number.NaN)).toBe("—");
  });

  it("falls back to the plain number when Intl formatting fails", () => {
    mockNumberFormatFailure();

    expect(formatNumber(42)).toBe("42");
  });
});

describe("formatPercent", () => {
  it("formats decimals as percentages and rejects invalid values", () => {
    expect(formatPercent(0.123)).toBe(
      new Intl.NumberFormat(undefined, {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(0.123),
    );
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(Number.NaN)).toBe("—");
  });

  it("uses arithmetic formatting when Intl formatting fails", () => {
    mockNumberFormatFailure();

    expect(formatPercent(0.123)).toBe("12.3%");
  });
});

describe("formatEngagementsPer100Views", () => {
  it("formats the API's already-scaled per-100 value without a percent sign", () => {
    expect(formatEngagementsPer100Views(166.67)).toBe("166.7");
  });

  it("returns an em dash for missing values", () => {
    expect(formatEngagementsPer100Views(null)).toBe("—");
    expect(formatEngagementsPer100Views(Number.NaN)).toBe("—");
  });

  it("falls back to fixed-point formatting when Intl formatting fails", () => {
    mockNumberFormatFailure();

    expect(formatEngagementsPer100Views(12.34)).toBe("12.3");
  });
});

describe("date formatters", () => {
  it("formats dates and date-times and handles missing values", () => {
    const value = "2026-10-30T14:30:00Z";
    expect(formatDate(value)).toBe(
      new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    );
    expect(formatDateTime(value)).toBe(
      new Date(value).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    expect(formatDate(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
  });

  it("returns the original value when date localization fails", () => {
    vi.spyOn(Date.prototype, "toLocaleDateString").mockImplementation(() => {
      throw new Error("date formatting unavailable");
    });
    vi.spyOn(Date.prototype, "toLocaleString").mockImplementation(() => {
      throw new Error("date-time formatting unavailable");
    });

    expect(formatDate("not-a-date")).toBe("not-a-date");
    expect(formatDateTime("not-a-date")).toBe("not-a-date");
  });
});