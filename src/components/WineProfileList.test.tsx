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
    localStorage.clear();
    currentUser = null;
    list.mockReset().mockResolvedValue(profiles);
    search.mockReset().mockResolvedValue({ wine_profiles: profiles });
  });

  it("shows the producer-style list by default and switches to cards", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: "Pinot Noir" })).toHaveAttribute("href", "/wine-profiles/pinot-noir");
    expect(screen.getByText("Burgundy")).toBeInTheDocument();
    expect(screen.getByText("Oregon")).toBeInTheDocument();
    expect(document.querySelector(".wine-management__card")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cards" }));

    expect(screen.getByRole("button", { name: "Cards" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector(".wine-management__card")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an edit action in list view for wine managers", async () => {
    currentUser = { roles: ["Editor"] };
    renderPage();

    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());

    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/wine-profiles/pinot-noir/edit");
  });
});