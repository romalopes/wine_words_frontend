import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { tradeApi } from "../services/api";
import TradeAdminPackageDetail from "./TradeAdminPackageDetail";

let user: ReturnType<typeof userEvent.setup>;

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, display_name: "Editor", roles: ["Editor"] },
    loading: false,
  }),
}));

const basePackage = {
  id: 45,
  status: "editorial_pending",
  items: [
    { id: 101, wine_name: "Rioja Reserva", vintage: "2020", item_status: "pending", review_progress: "not_eligible", received: false },
    { id: 102, wine_name: "Ribera del Duero", vintage: "2019", item_status: "pending", review_progress: "not_eligible", received: false },
  ],
  events: [],
  quotes: [],
  invoices: [],
};

const mockGetStaffPackage = vi.fn();
const mockGetStaffMessages = vi.fn();
const mockSendStaffMessage = vi.fn();
const mockAssessPackage = vi.fn();

vi.spyOn(tradeApi, "getStaffPackage").mockImplementation(mockGetStaffPackage);
vi.spyOn(tradeApi, "getStaffMessages").mockImplementation(mockGetStaffMessages);
vi.spyOn(tradeApi, "sendStaffMessage").mockImplementation(mockSendStaffMessage);
vi.spyOn(tradeApi, "assessPackage").mockImplementation(mockAssessPackage);

function renderPackageDetail(packageOverrides: Record<string, unknown> = {}) {
  mockGetStaffPackage.mockResolvedValue({ ...basePackage, ...packageOverrides });
  mockGetStaffMessages.mockResolvedValue([]);
  mockSendStaffMessage.mockResolvedValue({ id: 1 } as any);
  mockAssessPackage.mockResolvedValue({ ...basePackage, status: "approved" } as any);

  return render(
    <MemoryRouter initialEntries={["/admin/trade/packages/45"]}>
      <Routes>
        <Route path="/admin/trade/packages/:id" element={<TradeAdminPackageDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TradeAdminPackageDetail", () => {
  beforeEach(() => {
    user = userEvent.setup();
    vi.resetAllMocks();
    vi.spyOn(tradeApi, "getStaffPackage").mockImplementation(mockGetStaffPackage);
    vi.spyOn(tradeApi, "getStaffMessages").mockImplementation(mockGetStaffMessages);
    vi.spyOn(tradeApi, "sendStaffMessage").mockImplementation(mockSendStaffMessage);
    vi.spyOn(tradeApi, "assessPackage").mockImplementation(mockAssessPackage);
    mockGetStaffPackage.mockResolvedValue({ ...basePackage });
    mockGetStaffMessages.mockResolvedValue([]);
    mockSendStaffMessage.mockResolvedValue({ id: 1 } as any);
    mockAssessPackage.mockResolvedValue({ ...basePackage, status: "approved" } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the submission and shows the editorial decision form", async () => {
    renderPackageDetail();

    await waitFor(() =>
      expect(screen.getByText(/Trade submission #45/)).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByText(/Editorial pending/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Editorial decision/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Approve submission/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Reject submission/i })).toBeInTheDocument();
  });

  it("approves the submission and shows manage link", async () => {
    renderPackageDetail();
    await waitFor(() => screen.getByText(/Editorial decision/));

    await user.click(screen.getByRole("radio", { name: /Approve submission/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Approve submission/ })).not.toBeDisabled(),
    );

    await user.click(screen.getByRole("button", { name: /Approve submission/ }));

    await waitFor(() => expect(mockAssessPackage).toHaveBeenCalled());
    const call = mockAssessPackage.mock.calls[0]!;
    expect(call[0]).toBe("45");
    expect(call[1].decisions["101"]).toBe("approved");
    expect(call[1].decisions["102"]).toBe("approved");

    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Manage package/i })).toBeInTheDocument(),
    );
  });

  it("rejects the submission with a reason", async () => {
    renderPackageDetail();
    await waitFor(() => screen.getByText(/Editorial decision/));

    await user.click(screen.getByRole("radio", { name: /Reject submission/i }));
    const reasonInput = screen.getByPlaceholderText(/Explain the decision/);
    await user.type(reasonInput, "Wines do not meet quality standards.");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Reject submission/ })).not.toBeDisabled(),
    );

    await user.click(screen.getByRole("button", { name: /Reject submission/ }));

    await waitFor(() => expect(mockAssessPackage).toHaveBeenCalled());
    const call = mockAssessPackage.mock.calls[0]!;
    expect(call[0]).toBe("45");
    expect(call[1].decisions["101"]).toBe("rejected");
    expect(call[1].decisions["102"]).toBe("rejected");
    expect(call[1].reason).toBe("Wines do not meet quality standards.");
  });

  it("disables reject button without reason", async () => {
    renderPackageDetail();
    await waitFor(() => screen.getByText(/Editorial decision/));

    await user.click(screen.getByRole("radio", { name: /Reject submission/i }));

    expect(screen.getByRole("button", { name: /Reject submission/ })).toBeDisabled();

    const reasonInput = screen.getByPlaceholderText(/Explain the decision/);
    await user.type(reasonInput, "Some reason");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Reject submission/ })).not.toBeDisabled(),
    );
  });

  it("displays an error when assessment fails", async () => {
    renderPackageDetail();
    await waitFor(() => screen.getByText(/Editorial decision/));

    await user.click(screen.getByRole("radio", { name: /Approve submission/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Approve submission/ })).not.toBeDisabled(),
    );

    mockAssessPackage.mockRejectedValueOnce(new Error("boom"));

    await user.click(screen.getByRole("button", { name: /Approve submission/ }));

    await waitFor(() =>
      expect(screen.getByText(/Unable to record assessment/)).toBeInTheDocument(),
    );
  });
});