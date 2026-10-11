import { renderHook } from "@testing-library/react";
import { AuthProvider } from "../contexts/AuthContext";
import { useAnalyticsConsent } from "./useAnalyticsConsent";
import { useAuth } from "../contexts/AuthContext";

vi.mock("../contexts/AuthContext", async () => {
  const actual = await vi.importActual("../contexts/AuthContext");
  return {
    ...actual,
    useAuth: vi.fn(),
    AuthProvider: actual.AuthProvider,
  };
});

// Wrapper to provide AuthContext
function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("useAnalyticsConsent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true for anonymous user (implied consent)", () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null });

    const { result } = renderHook(() => useAnalyticsConsent(), { wrapper });

    expect(result.current).toBe(true);
  });

  it("returns true for authenticated user without opt-out", () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 1, email: "test@example.com", analytics_opt_out: false },
    });

    const { result } = renderHook(() => useAnalyticsConsent(), { wrapper });

    expect(result.current).toBe(true);
  });

  it("returns false for authenticated user with opt-out", () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 1, email: "test@example.com", analytics_opt_out: true },
    });

    const { result } = renderHook(() => useAnalyticsConsent(), { wrapper });

    expect(result.current).toBe(false);
  });
});