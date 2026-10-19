import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import VerifyEmail from "./VerifyEmail";

const mockVerify = vi.fn();

vi.mock("../services/api", () => ({
  emailVerificationsApi: {
    verify: (...args: unknown[]) => mockVerify(...args),
    resend: vi.fn(),
  },
}));

describe("VerifyEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits a one-time token only once in Strict Mode", async () => {
    mockVerify.mockResolvedValue({ message: "Your email address is verified." });

    render(
      <StrictMode>
        <MemoryRouter initialEntries={["/verify-email?token=strict-mode-token"]}>
          <VerifyEmail />
        </MemoryRouter>
      </StrictMode>,
    );

    await waitFor(() => {
      expect(mockVerify).toHaveBeenCalledTimes(1);
      expect(mockVerify).toHaveBeenCalledWith("strict-mode-token");
      expect(screen.getByRole("heading", { name: /email verified/i })).toBeInTheDocument();
    });
  });
});