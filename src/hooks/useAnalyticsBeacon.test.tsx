import { renderHook, act } from "@testing-library/react";
import { useAnalyticsBeacon, __resetInFlightRequests } from "./useAnalyticsBeacon";
import { analyticsApi } from "../services/api";
import { getVisitorId, clearVisitorId } from "../utils/analyticsIdentity";
import { getNavigationContext } from "../utils/analyticsNavigation";

vi.mock("../services/api", () => ({
  analyticsApi: {
    events: { create: vi.fn() },
  },
}));

vi.mock("../utils/analyticsIdentity", () => ({
  getVisitorId: vi.fn(() => "550e8400-e29b-41d4-a716-446655440000"),
  clearVisitorId: vi.fn(),
}));

vi.mock("../utils/analyticsNavigation", () => ({
  getNavigationContext: vi.fn(() => ({ source: "direct" })),
}));

vi.mock("./useAnalyticsConsent", () => ({
  useAnalyticsConsent: () => true,
}));

describe("useAnalyticsBeacon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetInFlightRequests();
    (analyticsApi.events.create as ReturnType<typeof vi.fn>).mockResolvedValue({ accepted: true });
  });

  it("sends beacon on trackView", async () => {
    const { result } = renderHook(() => useAnalyticsBeacon());

    await act(async () => {
      result.current.trackView("Article", 42);
    });

    // Microtask flush
    await act(async () => {});

    expect(analyticsApi.events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "view",
        content_type: "Article",
        content_id: 42,
        source: "direct",
        viewport: expect.stringMatching(/^\d+x\d+$/),
      })
    );
  });

  it("sends correct identity for authenticated user flow (visitor ID)", async () => {
    const { result } = renderHook(() => useAnalyticsBeacon());

    await act(async () => {
      result.current.trackView("Review", 123);
    });

    await act(async () => {});

    expect(getVisitorId).toHaveBeenCalled();
    expect(analyticsApi.events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content_type: "Review",
        content_id: 123,
      })
    );
  });

  it("suppresses duplicate within 30 min window", async () => {
    const { result } = renderHook(() => useAnalyticsBeacon());

    await act(async () => {
      result.current.trackView("Article", 42);
      result.current.trackView("Article", 42); // duplicate
    });

    await act(async () => {});

    expect(analyticsApi.events.create).toHaveBeenCalledTimes(1);
  });

  it("allows new event for different content", async () => {
    const { result } = renderHook(() => useAnalyticsBeacon());

    await act(async () => {
      result.current.trackView("Article", 42);
      result.current.trackView("Article", 43); // different content
    });

    await act(async () => {});

    expect(analyticsApi.events.create).toHaveBeenCalledTimes(2);
  });

  it("includes navigation context in payload", async () => {
    (getNavigationContext as ReturnType<typeof vi.fn>).mockReturnValue({
      source: "internal",
      referrer: "http://localhost:5173/wines/test-wine",
      fromContentType: "Wine",
      fromContentId: "test-wine",
    });

    const { result } = renderHook(() => useAnalyticsBeacon());

    await act(async () => {
      result.current.trackView("Review", 999);
    });

    await act(async () => {});

    expect(analyticsApi.events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "internal",
        referrer: "http://localhost:5173/wines/test-wine",
      })
    );
  });

  it("silently handles API errors", async () => {
    (analyticsApi.events.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useAnalyticsBeacon());

    await act(async () => {
      result.current.trackView("Article", 42);
    });

    await act(async () => {});

    expect(analyticsApi.events.create).toHaveBeenCalledTimes(1);
    // Should not throw
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("clears visitor ID on handleOptOut", () => {
    const { result } = renderHook(() => useAnalyticsBeacon());

    act(() => {
      result.current.handleOptOut();
    });

    expect(clearVisitorId).toHaveBeenCalled();
  });
});