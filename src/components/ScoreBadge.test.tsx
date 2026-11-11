import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ScoreBadge from "./ScoreBadge";
import { medalForScore } from "../utils/medal";

describe("ScoreBadge", () => {
  it("renders nothing for null / undefined score", () => {
    const { container } = render(<ScoreBadge score={null} />);
    expect(container.firstChild).toBeNull();

    const { container: c2 } = render(<ScoreBadge score={undefined} />);
    expect(c2.firstChild).toBeNull();
  });

  it("renders small badge (default) with Wine / score / Words", () => {
    render(<ScoreBadge score={92} />);
    const badge = screen.getByRole("img", { name: /Score 92:/ });
    expect(badge).toHaveClass("score-badge--sm");
    expect(badge).toHaveClass("score-badge--silver");
    expect(badge).toHaveTextContent("Wine");
    expect(badge).toHaveTextContent("92");
    expect(badge).toHaveTextContent("Words");
  });

  it("applies correct medal class for each tier", () => {
    const tiers: Array<[number, string]> = [
      [97, "score-badge--gold"],
      [92, "score-badge--silver"],
      [87, "score-badge--bronze"],
      [80, "score-badge--none"],
    ];
    tiers.forEach(([score, expectedClass]) => {
      const { unmount } = render(<ScoreBadge score={score} />);
      const badge = screen.getByRole("img");
      expect(badge).toHaveClass(expectedClass);
      unmount();
    });
  });

  it("clamps scores above 100 to Gold", () => {
    render(<ScoreBadge score={105} />);
    expect(screen.getByRole("img")).toHaveClass("score-badge--gold");
  });

  it("size='md' includes brand and byline", () => {
    render(<ScoreBadge score={94} size="md" />);
    const badge = screen.getByRole("img");
    expect(badge).toHaveClass("score-badge--md");
    expect(badge).toHaveTextContent("WINE WORDS");
    expect(badge).toHaveTextContent("94");
    expect(badge).toHaveTextContent("BY KASIA");
    // No caption in md
    expect(badge).not.toHaveTextContent("Silver Medal");
  });

  it("size='lg' includes brand and byline, no caption", () => {
    render(<ScoreBadge score={96} size="lg" />);
    const badge = screen.getByRole("img");
    expect(badge).toHaveClass("score-badge--lg");
    expect(badge).toHaveTextContent("WINE WORDS");
    expect(badge).toHaveTextContent("96");
    expect(badge).toHaveTextContent("BY KASIA");
    // Caption removed per design
    expect(badge).not.toHaveTextContent("Gold Medal");
    expect(badge).not.toHaveTextContent("Exceptional");
  });

  it("accessibility: aria-label contains score, medal name, and description", () => {
    render(<ScoreBadge score={89} />);
    const badge = screen.getByRole("img");
    expect(badge).toHaveAttribute(
      "aria-label",
      "Score 89: Bronze Medal — Very good commercial standard, fault-free"
    );
  });

  it("isDraft adds dashed outline class (used in ReviewCard)", () => {
    render(<ScoreBadge score={92} isDraft />);
    expect(screen.getByRole("img")).toHaveClass("score-badge--draft");
  });

  it("passes through custom className", () => {
    render(<ScoreBadge score={90} className="custom-class" />);
    expect(screen.getByRole("img")).toHaveClass("custom-class");
  });

  it("medalForScore returns expected info for each boundary (integration sanity)", () => {
    expect(medalForScore(95)?.id).toBe("gold");
    expect(medalForScore(94)?.id).toBe("silver");
    expect(medalForScore(85)?.id).toBe("bronze");
    expect(medalForScore(84)?.id).toBe("none");
  });
});