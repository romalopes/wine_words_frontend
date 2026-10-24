import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { winesApi, categoriesApi } from "../services/api";
import WineList from "./WineList";

vi.mock("../services/api", () => ({
  winesApi: {
    list: vi.fn(),
    grouped: vi.fn(),
    advancedSearch: vi.fn(),
  },
  categoriesApi: { list: vi.fn() },
}));

vi.mock("./WineCard", () => ({
  default: ({ wine }: { wine: { name: string } }) => <div>{wine.name}</div>,
}));
vi.mock("./Pagination", () => ({ default: () => null }));

// WineList reads `user` to decide whether to offer the "+ Add Wine" action.
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

function renderWineList(path = "/wines") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/wines" element={<WineList />} />
      </Routes>
    </MemoryRouter>,
  );
}

const winePayload = {
  items: [
    {
      id: 1,
      slug: "chardonnay-2022",
      name: "Chardonnay 2022",
      producer_name: "Test Estate",
      region: "Barossa Valley",
    },
  ],
  page: 1,
  per_page: 20,
  total_count: 1,
  total_pages: 1,
};

describe("WineList category view", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(winesApi.list).mockResolvedValue(winePayload);
    vi.mocked(winesApi.grouped).mockResolvedValue([]);
    vi.mocked(winesApi.advancedSearch).mockResolvedValue(winePayload);
    vi.mocked(categoriesApi.list).mockResolvedValue([
      {
        id: 1,
        name: "Chardonnay",
        slug: "chardonnay",
        for_wine: true,
        for_review: true,
        for_article: true,
        sort_order_wine: null,
        sort_order_review: null,
        sort_order_article: null,
      },
    ]);
  });

  it("shows the category hero, the filter chip and the wines in that category", async () => {
    renderWineList("/wines?category=Chardonnay");

    // The category view uses the same detail-style hero as the producer list.
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Chardonnay Wines" }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("heading", { name: "Chardonnay Wines" }).closest("header"),
    ).toHaveClass("wine-app__detail-hero");
    expect(screen.getByRole("link", { name: /Back to Dashboard/ })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByText("Cellar")).toBeInTheDocument();
    expect(screen.getByText("Chardonnay")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "← Show all categories" }),
    ).toHaveAttribute("href", "/wines");
    expect(await screen.findByText("Chardonnay 2022")).toBeInTheDocument();
  });

  it("clears the category filter from the chip", async () => {
    const user = userEvent.setup();
    renderWineList("/wines?category=Chardonnay");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Chardonnay Wines" }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "Clear category Chardonnay" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Wine List" }),
      ).toBeInTheDocument();
    });
  });
});
