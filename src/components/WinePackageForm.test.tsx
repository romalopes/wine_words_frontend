import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import WinePackageForm from "./WinePackageForm";

const mockCreate = vi.fn();
const mockSubmit = vi.fn();
const mockUpdate = vi.fn();
const mockShow = vi.fn();
const mockProducerSearch = vi.fn().mockResolvedValue([]);
const mockProducerCreate = vi.fn();
const mockImagesUpload = vi.fn().mockResolvedValue({});
const mockMyProducers = vi.fn();

vi.mock("../services/api", () => ({
  winePackagesApi: {
    create: (...args: unknown[]) => mockCreate(...args),
    submit: (...args: unknown[]) => mockSubmit(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    show: (...args: unknown[]) => mockShow(...args),
  },
  winePackageItemsApi: { create: vi.fn(), update: vi.fn(), destroy: vi.fn() },
  shipmentTrackingsApi: { show: vi.fn() },
  notificationsApi: { list: vi.fn() },
  winesApi: { search: vi.fn() },
  producersApi: {
    search: (...args: unknown[]) => mockProducerSearch(...args),
    create: (...args: unknown[]) => mockProducerCreate(...args),
  },
  usersApi: { search: vi.fn() },
  imagesApi: {
    upload: (...args: unknown[]) => mockImagesUpload(...args),
    destroy: vi.fn(),
    reorder: vi.fn(),
    setPrimary: vi.fn(),
  },
  accountApi: { myProducers: (...args: unknown[]) => mockMyProducers(...args) },
}));

let currentUser = { id: 1, display_name: "Reviewer", roles: ["Editor"] };

/**
 * The first argument of a mock's first call. `noUncheckedIndexedAccess` makes
 * every `calls[0][0]` access `undefined`-able, so the assertions read the value
 * through this instead of indexing inline.
 */
function firstCallArg(mock: { mock: { calls: unknown[][] } }): unknown {
  const call = mock.mock.calls[0];
  if (!call) throw new Error("expected the mock to have been called");
  return call[0];
}

/** The id and payload of a mock's first call, e.g. `update(id, payload)`. */
function firstCallArgs(mock: { mock: { calls: unknown[][] } }): [unknown, unknown] {
  const call = mock.mock.calls[0];
  if (!call) throw new Error("expected the mock to have been called");
  const [id, payload] = call;
  return [id, payload];
}

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: currentUser, loading: false }),
}));

function todayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function renderForm(path = "/wine-packages/new?mode=arrived") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<WinePackageForm />} path="/wine-packages/new" />
        <Route element={<WinePackageForm />} path="/wine-packages/:id/edit" />
      </Routes>
    </MemoryRouter>,
  );
}

describe("WinePackageForm (create)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { id: 1, display_name: "Reviewer", roles: ["Editor"] };
    mockProducerSearch.mockResolvedValue([{ id: 3, name: "Penfolds" }]);
    mockCreate.mockResolvedValue({ id: 9 });
    mockSubmit.mockResolvedValue({ id: 9, status: "requested" });
  });

  it("creates a producer request draft from the user's eligible producer", async () => {
    currentUser = { id: 9, display_name: "Producer Manager", roles: ["Reader"] };
    mockMyProducers.mockResolvedValue([
      { id: 3, name: "Penfolds", slug: "penfolds", membership_type: "manager", can_edit: true },
    ]);
    mockCreate.mockResolvedValue({ id: 99 });
    const user = userEvent.setup();
    renderForm("/wine-packages/new?mode=request");

    expect(await screen.findByRole("heading", { name: "New Package Request" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Your reference"), "REF-9");
    await user.type(screen.getByLabelText("Request notes"), "Please review these wines");
    await user.click(screen.getByRole("button", { name: "Save Draft and Add Wines" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      producer_id: 3,
      producer_reference: "REF-9",
      producer_notes: "Please review these wines",
    })));
  });

  it("creates and immediately submits a producer request without wines", async () => {
    currentUser = { id: 9, display_name: "Producer Manager", roles: ["Reader"] };
    mockMyProducers.mockResolvedValue([
      { id: 3, name: "Penfolds", slug: "penfolds", can_edit: true, membership_type: "manager" },
    ]);
    const user = userEvent.setup();

    renderForm("/wine-packages/new?mode=request");

    await screen.findByRole("heading", { name: "New Package Request" });
    await user.click(screen.getByRole("button", { name: "Create and Submit" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith(9));
    expect(mockCreate.mock.invocationCallOrder[0]).toBeLessThan(mockSubmit.mock.invocationCallOrder[0] ?? 0);
  });

  // The form uses ProducerSearch (type + pick), not a producer <select>.
  async function pickProducer(user: UserEvent, name = "Penfolds") {
    const input = await screen.findByPlaceholderText("Start typing a producer name…");
    await user.type(input, name.slice(0, 4));
    await screen.findByRole("button", { name });
    await user.click(screen.getByRole("button", { name }));
  }

  it("opens in 'Record Received Package' mode with today's arrival date", async () => {
    renderForm();

    expect(
      await screen.findByRole("heading", { name: "Record Received Package" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Arrived date")).toHaveValue(todayInputValue());
    expect(screen.getByLabelText("Review deadline")).toBeInTheDocument();
  });

  it("records a received package as arrived/unexpected with today's date", async () => {
    const user = userEvent.setup();
    renderForm();

    await screen.findByRole("heading", { name: "Record Received Package" });
    await pickProducer(user);
    await user.click(screen.getByRole("button", { name: "Create Package" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        producer_id: 3,
        status: "arrived",
        source: "unexpected",
        arrived_at: todayInputValue(),
      }),
    );
  });

  it("adds an expected package as announced without an arrival date", async () => {
    const user = userEvent.setup();
    renderForm("/wine-packages/new?mode=announced");

    await screen.findByRole("heading", { name: "Add Expected Package" });
    expect(screen.queryByLabelText("Arrived date")).not.toBeInTheDocument();

    await pickProducer(user);
    await user.click(screen.getByRole("button", { name: "Create Package" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "announced", source: "manual" }),
    );
    expect(firstCallArg(mockCreate)).not.toHaveProperty("arrived_at");
  });

  it("switches the default source when the entry mode changes", async () => {
    const user = userEvent.setup();
    renderForm();

    await screen.findByRole("heading", { name: "Record Received Package" });
    await user.click(screen.getByRole("radio", { name: "Add Producer Request" }));

    expect(screen.getByLabelText("Source")).toHaveValue("producer_request");
  });

  it("uploads staged images right after creating the package", async () => {
    const user = userEvent.setup();
    renderForm();

    await screen.findByRole("heading", { name: "Record Received Package" });
    await pickProducer(user);

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("the image manager's file input is missing");
    const first = new File(["a"], "box.jpg", { type: "image/jpeg" });
    const second = new File(["b"], "label.jpg", { type: "image/jpeg" });
    await user.upload(fileInput, [first, second]);

    await user.click(screen.getByRole("button", { name: "Create Package" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockImagesUpload).toHaveBeenCalledWith("wine_package", 9, [
        first,
        second,
      ]),
    );
  });

  it("still creates the package when no images are staged", async () => {
    const user = userEvent.setup();
    renderForm();

    await screen.findByRole("heading", { name: "Record Received Package" });
    await pickProducer(user);
    await user.click(screen.getByRole("button", { name: "Create Package" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockImagesUpload).not.toHaveBeenCalled();
  });
});

describe("WinePackageForm (edit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { id: 1, display_name: "Reviewer", roles: ["Editor"] };
    mockProducerSearch.mockResolvedValue([{ id: 3, name: "Penfolds" }]);
    mockShow.mockResolvedValue({
      id: 7,
      producer_id: 3,
      producer_name: "Penfolds",
      source: "unexpected",
      status: "arrived",
      expected_at: null,
      arrived_at: "2026-09-01T09:00:00Z",
      review_deadline: "2026-10-01",
      notes: "Left at reception",
      reviewer_id: 1,
    });
    mockUpdate.mockResolvedValue({ id: 7 });
  });

  it("loads the package and saves the editable fields", async () => {
    const user = userEvent.setup();
    renderForm("/wine-packages/7/edit");

    expect(await screen.findByRole("heading", { name: "Edit Package #7" })).toBeInTheDocument();
    expect(screen.getByLabelText("Review deadline")).toHaveValue("2026-10-01");

    await user.clear(screen.getByLabelText("Notes"));
    await user.type(screen.getByLabelText("Notes"), "Two bottles damaged");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    const [id, payload] = firstCallArgs(mockUpdate);
    expect(id).toBe("7");
    expect(payload).toMatchObject({ producer_id: 3, notes: "Two bottles damaged" });
    // Source and status belong to the workflow, not this form.
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("source");
  });

  it("shows the existing package images when editing", async () => {
    mockShow.mockResolvedValue({
      producer_id: 3,
      producer_name: "Penfolds",
      source: "manual",
      notes: "n",
      images: ["http://img.test/one.png", "http://img.test/two.png"],
      image_ids: [11, 12],
    });

    renderForm("/wine-packages/7/edit");

    await screen.findByRole("heading", { name: "Edit Package #7" });
    const thumbs = await screen.findAllByRole("img", { name: /attachment/ });
    expect(thumbs).toHaveLength(2);
  });

  it("does not offer the reviewer field to a non-admin", async () => {
    renderForm("/wine-packages/7/edit");

    await screen.findByRole("heading", { name: "Edit Package #7" });
    expect(screen.queryByLabelText("Reviewer (user id)")).not.toBeInTheDocument();
  });
});