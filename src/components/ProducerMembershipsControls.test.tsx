import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import ProducerMembershipsControls from "./ProducerMembershipsControls";
import type { ProducerSearchResult } from "../types/producer";
import type { ProducerMembership } from "../types/user";
import type { ProducerMembershipType } from "../types/producer";

const MEMBERSHIPS: ProducerMembership[] = [
  {
    id: 1,
    user: { id: 5, display_name: "Admin", email: "admin@example.com" },
    producer: {
      id: 100,
      name: "Château Margaux",
      slug: "chateau-margaux",
      country: "France",
    },
    membership_type: "manager",
    created_by: { id: 2, display_name: "Root" },
    created_at: "2024-01-01T00:00:00Z",
  },
];

const RESULTS = [
  {
    id: 200,
    name: "Domaine Romanée",
    slug: "domaine-romanee",
    country: { id: 7, name: "France", slug: "france" },
  },
] as unknown as ProducerSearchResult[];

const BASE = {
  memberships: MEMBERSHIPS,
  loading: false,
  newMembershipType: "manager" as ProducerMembershipType,
  onChangeNewMembershipType: vi.fn(),
  searchQuery: "",
  onSearchQuery: vi.fn(),
  searching: false,
  searchResults: [] as ProducerSearchResult[],
  onAddMembership: vi.fn(),
  onMembershipTypeChange: vi.fn(),
  onRemoveMembership: vi.fn(),
};

function renderControls(
  props: Partial<typeof BASE & Record<string, unknown>> = {},
) {
  return render(
    <MemoryRouter>
      <ProducerMembershipsControls {...BASE} {...props} />
    </MemoryRouter>,
  );
}

describe("ProducerMembershipsControls", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the search field and membership type selector with the three types", () => {
    renderControls();
    expect(
      screen.getByLabelText("Search producers by name"),
    ).toBeInTheDocument();
    const select = screen.getByLabelText("Membership type");
    expect(select).toHaveValue("manager");
    const options = within(select as HTMLElement);
    expect(options.getByRole("option", { name: "Owner" })).toBeInTheDocument();
    expect(options.getByRole("option", { name: "Manager" })).toBeInTheDocument();
    expect(
      options.getByRole("option", { name: "Contributor" }),
    ).toBeInTheDocument();
  });

  it("emits the typed search query", async () => {
    const user = userEvent.setup();
    renderControls();
    await user.type(screen.getByLabelText("Search producers by name"), "r");
    expect(BASE.onSearchQuery).toHaveBeenCalledWith("r");
  });

  it("shows a searching status only while a query is pending", () => {
    const { rerender } = renderControls({ searchQuery: "rom", searching: true });
    expect(screen.getByText("Searching…")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ProducerMembershipsControls
          {...BASE}
          searchQuery="rom"
          searching={false}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Searching…")).not.toBeInTheDocument();
  });

  it("lists matching producers and emits add on click", async () => {
    const user = userEvent.setup();
    renderControls({ searchQuery: "rom", searchResults: RESULTS });
    const result = screen.getByRole("button", { name: /Domaine Romanée/ });
    expect(result).toHaveTextContent("France");
    await user.click(result);
    expect(BASE.onAddMembership).toHaveBeenCalledWith(200);
  });

  it("shows an empty state when the search has no matches", () => {
    renderControls({ searchQuery: "zzz" });
    expect(screen.getByText("No matching producers.")).toBeInTheDocument();
  });

  it("renders linked producers with badge, provenance, and identity link", () => {
    renderControls();
    const link = screen.getByRole("link", { name: "Château Margaux" });
    expect(link).toHaveAttribute("href", "/producers/chateau-margaux");
    // Scope to the badge to avoid colliding with the row type selector's
    // "Manager" <option>, which renders the same string.
    expect(screen.getByText("Manager", { selector: ".membership-badge" })).toBeInTheDocument();
    expect(screen.getByText(/Linked by Root/)).toBeInTheDocument();
    expect(screen.getByText(/France/)).toBeInTheDocument();
  });

  it("emits membership type changes per row", async () => {
    const user = userEvent.setup();
    renderControls();
    await user.selectOptions(
      screen.getByLabelText("Membership type for Château Margaux"),
      "owner",
    );
    expect(BASE.onMembershipTypeChange).toHaveBeenCalledWith(1, "owner");
  });

  it("emits unlink for the row's remove button", async () => {
    const user = userEvent.setup();
    renderControls();
    await user.click(screen.getByRole("button", { name: "Unlink" }));
    expect(BASE.onRemoveMembership).toHaveBeenCalledWith(1);
  });

  it("shows an empty state when nothing is linked", () => {
    renderControls({ memberships: [] });
    expect(
      screen.getByText(/No linked producers yet/),
    ).toBeInTheDocument();
  });

  it("disables interactive controls while loading and shows the loading row", () => {
    renderControls({
      loading: true,
      searchQuery: "rom",
      searchResults: RESULTS,
    });
    expect(screen.getByText("Loading linked producers…")).toBeInTheDocument();
    expect(screen.getByLabelText("Membership type")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Domaine Romanée/ }),
    ).toBeDisabled();
  });

  it("honors the renderMember override for alternative identity layouts", () => {
    renderControls({
      renderMember: (membership: ProducerMembership) => (
        <p>{`Custom row ${membership.id}`}</p>
      ),
    });
    expect(screen.getByText("Custom row 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unlink" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});