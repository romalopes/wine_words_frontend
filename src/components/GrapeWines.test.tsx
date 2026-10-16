import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { grapesApi, winesApi } from "../services/api";
import GrapeWines from "./GrapeWines";

vi.mock("../services/api", () => ({
  grapesApi: { show: vi.fn() },
  winesApi: { list: vi.fn() },
}));
vi.mock("./WineTable", () => ({ default: () => <div>Wine results</div> }));
vi.mock("./Pagination", () => ({ default: () => null }));

function renderGrapeWines(slug = "chardonnay") {
  return render(
    <MemoryRouter initialEntries={[`/grapes/${slug}/wines`]}>
      <Routes>
        <Route path="/grapes/:slug/wines" element={<GrapeWines />} />
      </Routes>
    </MemoryRouter>,
  );
}

const grapePayload = {
  id: 5,
  slug: "chardonnay",
  name: "Chardonnay",
  wines_count: 0,
  producers_count: 0,
  main_regions: [],
  synonyms: [],
  is_blending_grape: false,
  notes: [],
};

describe("GrapeWines loading", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(grapesApi.show).mockResolvedValue(grapePayload);
    vi.mocked(winesApi.list).mockResolvedValue([]);
  });

  // Regression: while `grapesApi.show` was in flight the wine list stayed
  // disabled, `loading` was false, and the page flashed "No wines found for
  // this grape." instead of a loading state.
  it("shows a loading state while requests are in flight, never the empty state", async () => {
    let resolveGrape!: (value: typeof grapePayload) => void;
    vi.mocked(grapesApi.show).mockReturnValue(
      new Promise((resolve) => {
        resolveGrape = resolve;
      }),
    );
    let resolveWines!: (value: never[]) => void;
    vi.mocked(winesApi.list).mockReturnValue(
      new Promise((resolve) => {
        resolveWines = resolve;
      }),
    );
    renderGrapeWines();

    // Phase 1 — the grape is still resolving: loading, not the empty state.
    expect(screen.getByText("Loading wines…")).toBeInTheDocument();
    expect(screen.queryByText("No wines found for this grape.")).not.toBeInTheDocument();

    await act(async () => resolveGrape(grapePayload));
    // Phase 2 — grape loaded, list request fired and still pending: the
    // loading state holds.
    expect(await screen.findByText("Loading wines…")).toBeInTheDocument();
    expect(screen.queryByText("No wines found for this grape.")).not.toBeInTheDocument();

    await act(async () => resolveWines([]));
    // Phase 3 — both finished: only now may the empty state appear.
    expect(await screen.findByText("No wines found for this grape.")).toBeInTheDocument();
    expect(screen.queryByText("Loading wines…")).not.toBeInTheDocument();
  });

  it("shows the empty state only after both the grape and the list have loaded", async () => {
    renderGrapeWines();
    expect(
      await screen.findByText("No wines found for this grape."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading wines…")).not.toBeInTheDocument();
    expect(grapesApi.show).toHaveBeenCalledExactlyOnceWith("chardonnay");
    expect(winesApi.list).toHaveBeenCalledExactlyOnceWith({
      grape_id: 5,
      page: 1,
      per_page: 20,
    });
  });

  it("renders the table once the list resolves", async () => {
    vi.mocked(winesApi.list).mockResolvedValue([
      { id: 1, slug: "some-wine", name: "Some Wine" },
    ] as never);
    renderGrapeWines();
    expect(await screen.findByText("Wine results")).toBeInTheDocument();
  });

  it("shows a not-found message when the grape request fails", async () => {
    vi.mocked(grapesApi.show).mockRejectedValue(new Error("Grape not found"));
    renderGrapeWines();
    expect(await screen.findByText("Grape not found.")).toBeInTheDocument();
    expect(screen.queryByText("No wines found for this grape.")).not.toBeInTheDocument();
    expect(winesApi.list).not.toHaveBeenCalled();
  });
});