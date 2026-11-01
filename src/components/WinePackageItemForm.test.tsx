import type { ComponentProps } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import WinePackageItemForm from "./WinePackageItemForm";

// Partial mock: the real module is loaded and only the endpoints this form
// calls are replaced, so the test cannot break when unrelated exports change.
vi.mock("../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/api")>();
  return {
    ...actual,
    winesApi: { search: vi.fn(), create: vi.fn() },
    vintagesApi: { create: vi.fn() },
    winePackageItemsApi: { create: vi.fn(), update: vi.fn(), destroy: vi.fn() },
  };
});

import { winesApi, vintagesApi, winePackageItemsApi } from "../services/api";

// The module above replaces the endpoints this form calls with `vi.fn()`, so the
// real signatures are preserved but the mock controls are only visible through
// `vi.mocked`. Aliases keep the assertions below readable.
const mockWineSearch = vi.mocked(winesApi.search);
const mockWineCreate = vi.mocked(winesApi.create);
const mockVintageCreate = vi.mocked(vintagesApi.create);
const mockItemCreate = vi.mocked(winePackageItemsApi.create);
const mockItemUpdate = vi.mocked(winePackageItemsApi.update);

/**
 * `querySelector` returns `null` for a missing match. A test that cannot find
 * the element it is about to act on is a failing test, so this throws with a
 * message instead of letting `fireEvent` complain about a nullable argument.
 */
/** The first element matching `selector` inside `root`, narrowed to `T`. */
function query<T extends Element>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`No element matched "${selector}"`);
  return found;
}

/**
 * The first form rendered inside `root`. Used where the form under test *is* the
 * main line form, so the nearest enclosing one is also the only one.
 */
function firstForm(root: ParentNode): HTMLFormElement {
  const form = root.querySelector("form");
  if (!(form instanceof HTMLFormElement)) {
    throw new Error("no <form> was rendered");
  }
  return form;
}

/**
 * The form an element sits in. Mirrors `Element.closest("form")` but narrows the
 * result to `HTMLFormElement` and fails loudly when there is no enclosing form
 * — the inline create panels each post from their own form, so the tests need
 * to submit a specific one rather than the first on the page.
 */
function enclosingForm(element: Element): HTMLFormElement {
  const form = element.closest("form");
  if (!(form instanceof HTMLFormElement)) {
    throw new Error("the element is not inside a <form>");
  }
  return form;
}

// The producer's catalogue, as GET /wines/search?producer_id=3 returns it.
const PRODUCER_WINES = [
  {
    id: 1,
    name: "Grange",
    slug: "grange",
    color: "Red",
    vintages: [
      { id: 11, year: 2018, no_vintage: false },
      { id: 12, year: 2020, no_vintage: false },
    ],
  },
  {
    id: 2,
    name: "Bin 389",
    slug: "bin-389",
    color: "Red",
    vintages: [{ id: 21, year: null, no_vintage: true }],
  },
];

type FormOverrides = Partial<ComponentProps<typeof WinePackageItemForm>>;

function renderForm(overrides: FormOverrides = {}) {
  return render(
    <WinePackageItemForm
      packageId={7}
      producerId={3}
      producerName="Penfolds"
      onSaved={vi.fn()}
      onCancel={vi.fn()}
      {...overrides}
    />,
  );
}

describe("WinePackageItemForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWineSearch.mockResolvedValue(PRODUCER_WINES);
    mockWineCreate.mockResolvedValue({
      id: 9,
      name: "New Wine",
      slug: "new-wine",
      vintages: [{ id: 99, year: 2020, no_vintage: false }],
    });
    mockVintageCreate.mockResolvedValue({ id: 22, year: 2021, no_vintage: false });
    mockItemCreate.mockResolvedValue({
      id: 5,
      wine_package_id: 7,
      wine_id: 0,
    });
    mockItemUpdate.mockResolvedValue({
      id: 5,
      wine_package_id: 7,
      wine_id: 0,
    });
    vi.mocked(winePackageItemsApi.destroy).mockResolvedValue({});
  });

  it("lists the package producer's wines without typing a search", async () => {
    renderForm();

    await waitFor(() =>
      expect(mockWineSearch).toHaveBeenCalledWith({ producerId: 3 }),
    );
  });

  it("renders the producer's wines and their vintages", async () => {
    const { container } = renderForm();

    await waitFor(() => expect(mockWineSearch).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /Grange/i })).toBeTruthy(),
    );
    expect(screen.getByRole("option", { name: /Bin 389/i })).toBeTruthy();

    // Selecting a wine exposes that wine's vintages.
    const wineSelect = query<HTMLSelectElement>(container, "select");
    fireEvent.change(wineSelect, { target: { value: "1" } });

    await waitFor(() =>
      expect(screen.getByRole("option", { name: /2018/ })).toBeTruthy(),
    );
    expect(screen.getByRole("option", { name: /2020/ })).toBeTruthy();
  });

  it("refuses to submit a line without a vintage", async () => {
    const { container } = renderForm();

    await waitFor(() => expect(mockWineSearch).toHaveBeenCalled());

    // Nothing picked at all. Choosing a wine preselects its newest vintage, so
    // the "no vintage" case only exists before any wine is chosen.
    fireEvent.submit(firstForm(container));

    await waitFor(() => expect(mockItemCreate).not.toHaveBeenCalled());
    expect(
      screen.getByText(
        /Pick a wine and a vintage, or mark the line as not in the catalogue yet/i,
      ),
    ).toBeTruthy();
  });

  it("submits the selected vintage with the line", async () => {
    const { container } = renderForm();

    // The vintage select is only rendered once a wine is chosen, and the wine
    // select stays disabled until the catalogue arrives.
    await screen.findByRole("option", { name: /Grange/i });
    fireEvent.change(screen.getByLabelText(/^wine$/i), { target: { value: "1" } });

    fireEvent.change(await screen.findByLabelText(/^vintage$/i), {
      target: { value: "11" },
    });
    fireEvent.submit(firstForm(container));

    await waitFor(() => expect(mockItemCreate).toHaveBeenCalled());
    const payload = mockItemCreate.mock.calls[0]?.at(-1);
    expect(payload).toMatchObject({ vintage_id: 11, review_requested: true });
    expect(mockItemCreate.mock.calls[0]?.[0]).toBe(7);
  });

  it("allows adding a vintage to a wine already in the catalogue", async () => {
    renderForm();

    await screen.findByRole("option", { name: /Grange/i });
    expect(screen.getByRole("button", { name: /add a new wine/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^wine$/i), { target: { value: "1" } });

    // The inline panel replaces the line form and posts its own request.
    fireEvent.click(await screen.findByRole("button", { name: /add a vintage/i }));

    fireEvent.change(await screen.findByLabelText(/^year$/i), {
      target: { value: "2021" },
    });
    fireEvent.submit(
      enclosingForm(screen.getByRole("button", { name: /^add vintage$/i })),
    );

    await waitFor(() => expect(mockVintageCreate).toHaveBeenCalled());
    expect(mockVintageCreate).toHaveBeenCalledWith("grange", {
      year: 2021,
      no_vintage: false,
    });
  });

  it("allows creating a wine that is not in the catalogue yet", async () => {
    renderForm();

    await screen.findByRole("option", { name: /Grange/i });

    fireEvent.click(await screen.findByRole("button", { name: /add a new wine/i }));

    const name = await screen.findByLabelText(/wine name/i);
    fireEvent.change(name, { target: { value: "New Wine" } });
    fireEvent.submit(enclosingForm(name));

    await waitFor(() => expect(mockWineCreate).toHaveBeenCalled());

    const payload = mockWineCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    // The producer is pre-filled from the package and locked in the form.
    expect(payload).toMatchObject({ name: "New Wine", producer_id: 3 });
    // The wine and its first vintage are created in one request.
    expect(payload.vintages_attributes).toHaveLength(1);
  });

  it("saves a line marked as not in the catalogue yet without a vintage", async () => {
    renderForm();

    await screen.findByRole("option", { name: /Grange/i });

    fireEvent.click(screen.getByLabelText(/not in the catalogue yet/i));
    fireEvent.submit(enclosingForm(screen.getByRole("button", { name: /add line/i })));

    await waitFor(() => expect(mockItemCreate).toHaveBeenCalled());
    expect(mockItemCreate.mock.calls[0]?.[0]).toBe(7);
    expect(mockItemCreate.mock.calls[0]?.[1]).toMatchObject({
      vintage_id: null,
    });
  });

  it("requires and submits proposed wine details in producer mode", async () => {
    renderForm({ producerMode: true });
    await screen.findByRole("option", { name: /Grange/i });
    expect(screen.getByRole("button", { name: /add a new wine/i })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/not in the catalogue yet/i));
    fireEvent.change(screen.getByLabelText("Wine name"), { target: { value: "Estate Shiraz" } });
    fireEvent.change(screen.getByLabelText(/Vintage year/i), { target: { value: "2022" } });
    fireEvent.submit(enclosingForm(screen.getByRole("button", { name: /add line/i })));

    await waitFor(() => expect(mockItemCreate).toHaveBeenCalled());
    expect(mockItemCreate.mock.calls[0]?.[1]).toMatchObject({
      vintage_id: null,
      proposed_wine_name: "Estate Shiraz",
      proposed_vintage_year: 2022,
    });
  });

  it("lets a producer owner add a vintage to a catalogue wine", async () => {
    mockVintageCreate.mockResolvedValue({ id: 99, year: 2024, no_vintage: false });
    renderForm({ producerMode: true });

    await screen.findByRole("option", { name: /Grange/i });
    fireEvent.change(screen.getByLabelText(/^wine$/i), { target: { value: "1" } });
    fireEvent.click(await screen.findByRole("button", { name: /add a vintage/i }));
    fireEvent.change(await screen.findByLabelText(/^year$/i), { target: { value: "2024" } });
    fireEvent.submit(enclosingForm(screen.getByRole("button", { name: /^add vintage$/i })));

    await waitFor(() => expect(mockVintageCreate).toHaveBeenCalledWith("grange", {
      year: 2024,
      no_vintage: false,
    }));
  });
});