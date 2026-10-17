import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { grapesApi } from "../services/api";
import Grapes from "./Grapes";

vi.mock("../services/api", () => ({
  grapesApi: { list: vi.fn() },
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock("./Pagination", () => ({ default: () => null }));

function renderGrapes() {
  return render(
    <MemoryRouter initialEntries={["/grapes"]}>
      <Routes>
        <Route path="/grapes" element={<Grapes />} />
      </Routes>
    </MemoryRouter>,
  );
}

const grape = {
  id: 1,
  slug: "chardonnay",
  name: "Chardonnay",
  color: "white",
  origin_country: "France",
  synonyms: [],
  wines_count: 0,
  producers_count: 0,
};

describe("Grapes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(grapesApi.list).mockResolvedValue([]);
  });

  // Regression: while the list request is in flight the page must show a
  // loading state, never flash "No grapes found."
  it("shows a loading state while the list request is in flight", async () => {
    let resolveList!: (value: []) => void;
    vi.mocked(grapesApi.list).mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );
    renderGrapes();

    expect(screen.getByText("Loading grapes…")).toBeInTheDocument();
    expect(screen.queryByText("No grapes found.")).not.toBeInTheDocument();

    await act(async () => resolveList([]));
    expect(await screen.findByText("No grapes found.")).toBeInTheDocument();
    expect(screen.queryByText("Loading grapes…")).not.toBeInTheDocument();
  });

  it("shows the empty state only after the list has loaded", async () => {
    renderGrapes();
    expect(await screen.findByText("No grapes found.")).toBeInTheDocument();
    expect(screen.queryByText("Loading grapes…")).not.toBeInTheDocument();
    expect(grapesApi.list).toHaveBeenCalledExactlyOnceWith({
      page: 1,
      per_page: 20,
    });
  });

  it("renders the grape table once the list resolves", async () => {
    vi.mocked(grapesApi.list).mockResolvedValue([grape] as never);
    renderGrapes();
    expect(await screen.findByText("Chardonnay")).toBeInTheDocument();
    expect(screen.getByText("white")).toBeInTheDocument();
  });

  it("shows an error when the list request fails", async () => {
    vi.mocked(grapesApi.list).mockRejectedValue(new Error("Grapes not found"));
    renderGrapes();
    expect(await screen.findByText(/Grapes not found/)).toBeInTheDocument();
  });

  it("passes page and per_page to grapesApi.list for pagination", async () => {
    vi.mocked(grapesApi.list).mockResolvedValue({
      items: [grape],
      page: 1,
      per_page: 20,
      total_count: 45,
      total_pages: 3,
    } as never);
    renderGrapes();
    expect(await screen.findByText("Chardonnay")).toBeInTheDocument();
    expect(grapesApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, per_page: 20 }),
    );
  });

  // Server-side ordering: changing the select refetches with ?sort=; the
  // relevance default sends no sort param (API default).
  it("requests the server-sorted page when the sort select changes", async () => {
    renderGrapes();
    expect(await screen.findByText("No grapes found.")).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByRole("combobox", { name: "Sort grapes" }), {
        target: { value: "wines_count" },
      });
    });

    expect(grapesApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "wines_count", page: 1, per_page: 20 }),
    );
  });
});
