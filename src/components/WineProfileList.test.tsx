import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import WineProfileList from "./WineProfileList";

const list = vi.fn();
const search = vi.fn();
let currentUser: { roles: string[] } | null = null;

vi.mock("../services/api", () => ({
  wineProfilesApi: {
    list: (...args: unknown[]) => list(...args),
    search: (...args: unknown[]) => search(...args),
  },
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: currentUser }),
}));

const profiles = [
  {
    id: 1,
    slug: "pinot-noir",
    name: "Pinot Noir",
    color: "Red",
    grapes: ["Pinot Noir"],
    regions: ["Burgundy", "Oregon"],
    notes: ["Cherry", "Earth"],
    serving: "Serve slightly chilled.",
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <WineProfileList />
    </MemoryRouter>,
  );
}

describe("WineProfileList", () => {
  beforeEach(() => {
    currentUser = null;
    list.mockReset().mockResolvedValue(profiles);
    search.mockReset().mockResolvedValue({ wine_profiles: profiles });
  });

  it("shows cards by default and switches to the producer-style list view", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(document.querySelector(".wine-management__card")).toBeInTheDocument());
    expect(document.querySelector(".wine-management__card")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cards" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "List" }));

    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pinot Noir" })).toHaveAttribute("href", "/wine-profiles/pinot-noir");
    expect(screen.getByText("Burgundy, Oregon")).toBeInTheDocument();
    expect(document.querySelector(".wine-management__card")).not.toBeInTheDocument();
  });

  it("shows an edit action in list view for wine managers", async () => {
    currentUser = { roles: ["Editor"] };
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(document.querySelector(".wine-management__card")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "List" }));

    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/wine-profiles/pinot-noir/edit");
  });
});