import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import type { API as NoUiSliderAPI } from "nouislider";
import WineAdvancedSearch from "./WineAdvancedSearch";

vi.mock("../services/api", () => ({
  tasteParametersApi: {
    list: () => Promise.resolve({}),
  },
}));

vi.mock("./RegionSearch", () => ({ default: () => null }));
vi.mock("./GrapeSearch", () => ({ default: () => null }));

/** Renders the panel with the form expanded. */
function renderPanel(onSearch = vi.fn()) {
  return render(
    <WineAdvancedSearch
      onSearch={onSearch}
      onClear={() => {}}
      open
      onToggleOpen={() => {}}
    />
  );
}

/** The nouislider instance backing the nth `.noUi-target` element. */
function sliderInstance(index: number) {
  const target = document.querySelectorAll<HTMLElement>(".noUi-target")[index];
  if (!target) throw new Error(`no slider at index ${index}`);
  // nouislider stores the API on the target element as `noUiSlider`.
  const api = (target as unknown as { noUiSlider?: NoUiSliderAPI }).noUiSlider;
  if (!api) throw new Error("slider instance not found");
  return api;
}

describe("WineAdvancedSearch taste sliders", () => {
  beforeEach(() => {
    // nouislider measures the DOM; jsdom has no layout, so give the target a
    // non-zero size and a stubbed rect.
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
      configurable: true,
      value: function () {
        return { left: 0, right: 200, top: 0, bottom: 4, width: 200, height: 4, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
      },
    });
  });

  afterEach(cleanup);

  it("renders one dual-thumb noUiSlider per taste parameter", () => {
    renderPanel();

    const targets = document.querySelectorAll(".noUi-target");
    expect(targets).toHaveLength(6);

    // Each slider has exactly two handles.
    targets.forEach((t) => {
      expect(t.querySelectorAll(".noUi-handle")).toHaveLength(2);
    });
  });

  it("gives each handle an accessible label and slider role", () => {
    renderPanel();

    const sliders = screen.getAllByRole("slider");
    expect(sliders).toHaveLength(12);

    const lower = sliders.filter((el) => el.getAttribute("aria-label")?.endsWith("minimum"));
    const upper = sliders.filter((el) => el.getAttribute("aria-label")?.endsWith("maximum"));
    expect(lower).toHaveLength(6);
    expect(upper).toHaveLength(6);

    // The labels name the parameter they belong to.
    expect(lower[0]?.getAttribute("aria-label")).toMatch(/^Acidity minimum$/);
    expect(upper[0]?.getAttribute("aria-label")).toMatch(/^Acidity maximum$/);
  });

  it("renders the current range as text next to each slider", () => {
    renderPanel();
    expect(screen.getAllByText("0 – 10")).toHaveLength(6);
  });

  it("keeps the slider instance alive across range changes", () => {
    renderPanel();
    const before = sliderInstance(0);

    // Move the lower handle programmatically and let React re-render.
    act(() => {
      before.set([4, 10]);
    });

    // Same instance -> the slider was not destroyed and recreated.
    expect(sliderInstance(0)).toBe(before);
  });

  it("resets the slider position when the form is cleared", () => {
    renderPanel();
    const instance = sliderInstance(0);

    act(() => {
      instance.set([4, 7]);
    });
    expect(instance.get(true)).toEqual([4, 7]);

    const clearBtn = screen.getByRole("button", { name: /clear/i });
    fireEvent.click(clearBtn);

    // The slider itself is reset, not just the text.
    expect(instance.get(true)).toEqual([0, 10]);
    expect(screen.getAllByText("0 – 10")).toHaveLength(6);
  });

  it("submits the taste range as min/max query params", () => {
    const onSearch = vi.fn();
    renderPanel(onSearch);

    act(() => {
      sliderInstance(0).set([3, 8]);
    });

    fireEvent.click(screen.getByRole("button", { name: /search wines/i }));

    expect(onSearch).toHaveBeenCalledTimes(1);
    const params = onSearch.mock.calls[0]?.[0];
    expect(params?.acidity_min).toBe(3);
    expect(params?.acidity_max).toBe(8);
    // Untouched parameters are not sent.
    expect(params?.tannin_min).toBeUndefined();
    expect(params?.tannin_max).toBeUndefined();
  });

  it("clamps the minimum handle so it cannot pass the maximum", () => {
    renderPanel();
    const instance = sliderInstance(0);

    act(() => {
      instance.set([6, 6]);
    });
    const [min, max] = instance.get(true) as number[];
    expect(min!).toBeLessThanOrEqual(max!);
  });

  it("is keyboard accessible: arrow keys move the focused handle", () => {
    renderPanel();
    const instance = sliderInstance(0);

    const handles = screen.getAllByRole("slider");
    const lower = handles.find((el) => el.getAttribute("aria-label") === "Acidity minimum");
    expect(lower).toBeDefined();
    // nouislider makes the handles focusable.
    expect(lower?.getAttribute("tabindex")).toBe("0");

    act(() => {
      lower?.focus();
      fireEvent.keyDown(lower!, { key: "ArrowRight" });
    });

    // One step to the right on a 0-10 scale.
    expect(instance.get(true)).toEqual([1, 10]);
    expect(screen.getAllByText("1 – 10")).toHaveLength(1);
  });

  it("moves the upper handle with the keyboard and never crosses the lower one", () => {
    renderPanel();
    const instance = sliderInstance(0);

    const handles = screen.getAllByRole("slider");
    const upper = handles.find((el) => el.getAttribute("aria-label") === "Acidity maximum");
    expect(upper).toBeDefined();

    act(() => {
      upper?.focus();
      // Ten steps to the left brings the maximum down to the minimum.
      for (let i = 0; i < 10; i++) {
        fireEvent.keyDown(upper!, { key: "ArrowLeft" });
      }
    });

    expect(instance.get(true)).toEqual([0, 0]);
  });
});

describe("WineAdvancedSearch layout", () => {
  afterEach(cleanup);

  /** The label text of every row of the "Vintages & reviews" block. */
  function rowLabels(): string[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[class*="_rowLabel_"]'))
      .map((el) => el.textContent?.trim() ?? "");
  }

  it("gives every range its own row, from vintage year through grape", () => {
    renderPanel();

    const labels = rowLabels();
    for (const expected of [
      "Vintage year",
      "Price of vintage (currency)",
      "Review score (0-100)",
      "Drink from (year)",
      "Drink to (year)",
      "Review published between",
      "Country or Region",
      "Grape",
    ]) {
      expect(labels).toContain(expected);
    }
  });

  it("gives each min/max input a distinct accessible name", () => {
    renderPanel();

    // Six ranges * two bounds, each with its own name, so a screen reader
    // never hears two fields called just "Min".
    const names = Array.from(document.querySelectorAll<HTMLElement>("input"))
      .map((el) => el.getAttribute("aria-label"))
      .filter((n): n is string => n !== null);

    expect(names).toContain("Vintage year minimum");
    expect(names).toContain("Vintage year maximum");
    expect(names).toContain("Price of vintage minimum");
    expect(names).toContain("Review score maximum");
    expect(names).toContain("Drink from minimum");
    expect(names).toContain("Drink to maximum");
    expect(new Set(names).size).toBe(names.length);
  });

  it("still submits the range values after the layout change", () => {
    const onSearch = vi.fn();
    renderPanel(onSearch);

    const vintageMin = document.querySelector<HTMLInputElement>(
      'input[name="vintage_year_min"]'
    );
    expect(vintageMin).not.toBeNull();
    fireEvent.change(vintageMin!, { target: { value: "2015" } });

    fireEvent.click(screen.getByRole("button", { name: /search wines/i }));

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch.mock.calls[0]?.[0]?.vintage_year_min).toBe("2015");
  });
});
