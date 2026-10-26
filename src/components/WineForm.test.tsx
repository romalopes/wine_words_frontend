import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { categoriesApi, tasteParametersApi, wineProfilesApi } from "../services/api";
import WineForm from "./WineForm";

vi.mock("../services/api", () => ({
  winesApi: { create: vi.fn(), show: vi.fn(), update: vi.fn() },
  tasteParametersApi: { list: vi.fn() },
  imagesApi: { create: vi.fn() },
  categoriesApi: { list: vi.fn() },
  wineProfilesApi: { search: vi.fn() },
}));

vi.mock("./ImageManager", () => ({ default: () => null }));
vi.mock("./ProducerSearch", () => ({ default: () => null }));
vi.mock("./GrapeSearch", () => ({ default: () => null }));
vi.mock("./RegionSearch", () => ({ default: () => null }));

function renderWineForm() {
  return render(
    <MemoryRouter initialEntries={["/wines/new"]}>
      <Routes>
        <Route path="/wines/new" element={<WineForm />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("WineForm wine-profile selection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(tasteParametersApi.list).mockResolvedValue([]);
    vi.mocked(categoriesApi.list).mockResolvedValue([]);
    vi.mocked(wineProfilesApi.search).mockResolvedValue({
      wines: [],
      wine_profiles: [
        {
          id: 42,
          slug: "merlot",
          name: "Merlot",
          color: "Red",
          grapes: ["Merlot"],
          regions: ["Bordeaux"],
          parameters: { body: 4 },
        },
      ],
    });
  });

  it("selects a profile returned by search", async () => {
    const user = userEvent.setup();
    renderWineForm();

    await waitFor(() => expect(tasteParametersApi.list).toHaveBeenCalled());
    await user.type(screen.getByRole("searchbox", { name: "Wine profile" }), "Merlot");

    const profileName = await screen.findByText("Merlot", { selector: "strong" });
    const result = profileName.closest("button");
    expect(result).not.toBeNull();
    expect(result).toBeEnabled();
    await user.click(result!);

    expect(screen.getByText("Selected profile: Merlot")).toBeInTheDocument();
  });
});