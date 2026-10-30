import { act, fireEvent, render, screen } from "@testing-library/react";
import ShareButton from "./ShareButton";

const mockCopyText = vi.hoisted(() => vi.fn());

vi.mock("../utils/clipboard", () => ({
  copyText: mockCopyText,
}));

describe("ShareButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCopyText.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("copies the current URL, confirms success, and resets after two seconds", async () => {
    mockCopyText.mockResolvedValue(undefined);
    render(<ShareButton label="this review" className="extra" />);

    const button = screen.getByRole("button", { name: "Copy link to this review" });
    expect(button).toHaveClass("article-page__share", "extra");
    fireEvent.click(button);

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockCopyText).toHaveBeenCalledExactlyOnceWith(window.location.href);
    expect(screen.getByRole("button", { name: "Link copied" })).toHaveTextContent("Link copied!");

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("button", { name: "Copy link to this review" })).toHaveTextContent("Share");
  });

  it("shows a failure state when the URL cannot be copied", async () => {
    mockCopyText.mockRejectedValue(new Error("blocked"));
    render(<ShareButton />);

    fireEvent.click(screen.getByRole("button", { name: "Copy link to this page" }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("Copy failed")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Copy link to this page");
  });
});