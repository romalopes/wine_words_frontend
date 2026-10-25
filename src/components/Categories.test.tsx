import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Categories from "./Categories";

const list = vi.fn();
const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();
const reorder = vi.fn();

vi.mock("../services/api", () => ({
  categoriesApi: {
    list: () => list(),
    create: (payload: unknown) => create(payload),
    update: (id: number, payload: unknown) => update(id, payload),
    remove: (id: number) => remove(id),
    reorder: (type: string, ids: number[]) => reorder(type, ids),
  },
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { roles: ["Admin"] } }),
}));

const categories = [
  {
    id: 1,
    name: "Classic regions",
    slug: "classic-regions",
    for_wine: true,
    for_review: false,
    for_article: true,
    sort_order_wine: 1,
    sort_order_review: null,
    sort_order_article: 1,
  },
  {
    id: 2,
    name: "Tasting guides",
    slug: "tasting-guides",
    for_wine: false,
    for_review: true,
    for_article: true,
    sort_order_wine: null,
    sort_order_review: 1,
    sort_order_article: 2,
  },
];

describe("Categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    list.mockResolvedValue(categories);
    create.mockResolvedValue({});
  });

  it("switches HeroUI tabs between category libraries", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Categories />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("link", { name: "Classic regions" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Tasting guides" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Review categories" }));

    expect(screen.getByRole("link", { name: "Tasting guides" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Classic regions" })).not.toBeInTheDocument();
  });

  it("creates a category from the HeroUI form", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Categories />
      </MemoryRouter>,
    );

    await user.type(await screen.findByLabelText("Name"), "Natural wines");
    await user.click(screen.getByRole("checkbox", { name: "Wine" }));
    await user.click(screen.getByRole("button", { name: "Create category" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        name: "Natural wines",
        for_wine: true,
        for_review: false,
        for_article: false,
      }),
    );
  });
});