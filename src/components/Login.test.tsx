import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import Login from "./Login";

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockSocialSignIn = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    signIn: (...args: unknown[]) => mockSignIn(...args),
    signUp: (...args: unknown[]) => mockSignUp(...args),
    socialSignIn: (...args: unknown[]) => mockSocialSignIn(...args),
  }),
}));

vi.mock("../services/api", () => ({
  authApi: { forgotPassword: vi.fn() },
  emailVerificationsApi: { resend: vi.fn() },
}));

vi.mock("../services/socialProviders", () => ({
  PROVIDER_LABELS: {},
  ProviderCancelledError: class ProviderCancelledError extends Error {},
  ProviderConfigurationError: class ProviderConfigurationError extends Error {},
  availableProviders: () => [],
  signInWith: vi.fn(),
}));

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

function renderLoginAt(path: string, state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <Routes>
        <Route path="/" element={<LocationProbe />} />
        <Route path="/login" element={<Login />} />
        <Route path="/wines" element={<LocationProbe />} />
        <Route path="/subscribe" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSignIn.mockResolvedValue({});
});

describe("Login return redirect", () => {
  it("returns to /subscribe after sign-in when routed from there", async () => {
    const user = userEvent.setup();
    renderLoginAt("/login", { from: "/subscribe" });

    await user.type(screen.getByLabelText(/email/i), "taster@example.com");
    await user.type(screen.getByLabelText(/^password/i), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: "taster@example.com",
        password: "secret123",
      });
      expect(screen.getByTestId("location")).toHaveTextContent("/subscribe");
    });
  });

  it("falls back to the dashboard with no return state", async () => {
    const user = userEvent.setup();
    renderLoginAt("/login");

    await user.type(screen.getByLabelText(/email/i), "taster@example.com");
    await user.type(screen.getByLabelText(/^password/i), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      // Exact match: "/wines" also contains "/", so a substring assertion
      // would not prove the fallback changed.
      expect(screen.getByTestId("location").textContent).toBe("/");
    });
  });

  it("ignores external return targets", async () => {
    const user = userEvent.setup();
    renderLoginAt("/login", { from: "https://evil.example/phish" });

    await user.type(screen.getByLabelText(/email/i), "taster@example.com");
    await user.type(screen.getByLabelText(/^password/i), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toBe("/");
    });
  });
});

describe("account names on signup", () => {
  it("collects first and last names instead of a username", async () => {
    const user = userEvent.setup();
    mockSignUp.mockResolvedValue({});
    renderLoginAt("/login");
    await user.click(screen.getByRole("button", { name: "Create an account" }));
    expect(screen.queryByLabelText(/user name|username/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("First name"), " Élodie ");
    await user.type(screen.getByLabelText("Last name"), " O’Connor ");
    await user.type(screen.getByLabelText("Email"), "elodie@example.com");
    await user.type(screen.getByLabelText(/^Password$/), "secret123");
    await user.type(screen.getByLabelText(/confirm password/i), "secret123");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(mockSignUp).toHaveBeenCalledWith({
      first_name: "Élodie", last_name: "O’Connor", email: "elodie@example.com",
      password: "secret123", password_confirmation: "secret123",
    }));
  });

  it("requires both names before submitting signup", async () => {
    const user = userEvent.setup();
    renderLoginAt("/login");
    await user.click(screen.getByRole("button", { name: "Create an account" }));
    await user.type(screen.getByLabelText("First name"), "Élodie");
    await user.type(screen.getByLabelText("Email"), "elodie@example.com");
    await user.type(screen.getByLabelText(/^Password$/), "secret123");
    await user.type(screen.getByLabelText(/confirm password/i), "secret123");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText("First name and last name are required.")).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });
});
