import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PersonalInformationControls from "./PersonalInformationControls";
import { EMPTY_PERSONAL_INFORMATION } from "../types/personalInformation";
import type { PersonalInformationForm } from "../types/personalInformation";
import type { CountryListItem } from "../types/reference";

const COUNTRIES = [
  { id: 7, name: "France", slug: "france", producers_count: 0 },
  { id: 9, name: "Italy", slug: "italy", producers_count: 0 },
] as unknown as CountryListItem[];

const BASE = {
  value: { ...EMPTY_PERSONAL_INFORMATION },
  onChangeField: vi.fn(),
  onChangeAddressField: vi.fn(),
  countries: COUNTRIES,
  onSubmit: vi.fn(),
};

function renderControls(
  props: Partial<typeof BASE & Record<string, unknown>> = {},
) {
  return render(<PersonalInformationControls {...BASE} {...props} />);
}

describe("PersonalInformationControls", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the personal fields and the address fields with defaults", () => {
    renderControls({ title: "Personal information" });
    expect(screen.getByLabelText("First name")).toHaveValue("");
    expect(screen.getByLabelText("Last name")).toHaveValue("");
    expect(screen.getByLabelText("Phone")).toHaveValue("");
    expect(screen.getByLabelText("Date of birth")).toHaveValue("");
    expect(screen.getByLabelText("Street")).toHaveValue("");
    expect(screen.getByLabelText("City")).toHaveValue("");
    expect(screen.getByLabelText("State")).toHaveValue("");
    expect(screen.getByLabelText("Postal code")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Save personal information" }),
    ).toBeInTheDocument();
  });

  it("emits per-field changes", () => {
    renderControls({ title: "Personal information" });
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Jane" },
    });
    expect(BASE.onChangeField).toHaveBeenCalledWith("first_name", "Jane");
    fireEvent.change(screen.getByLabelText("Street"), {
      target: { value: "1 Main Street" },
    });
    expect(BASE.onChangeAddressField).toHaveBeenCalledWith(
      "street_address",
      "1 Main Street",
    );
  });

  it("lists the provided countries in the country select", async () => {
    const user = userEvent.setup();
    renderControls({ title: "Personal information" });
    const select = screen.getByLabelText("Country");
    expect(
      screen.getByRole("option", { name: "— Select country —" }),
    ).toBeInTheDocument();
    await user.selectOptions(select, "9");
    expect(BASE.onChangeAddressField).toHaveBeenCalledWith("country_id", "9");
  });

  it("submits the form through the provided handler", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: Event) => e.preventDefault());
    renderControls({
      title: "Personal information",
      onSubmit,
      // Required fields must be filled or native validation blocks submission.
      value: {
        ...EMPTY_PERSONAL_INFORMATION,
        first_name: "Jane",
        last_name: "Doe",
      },
    });
    await user.click(
      screen.getByRole("button", { name: "Save personal information" }),
    );
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("disables the submit button while saving and relabels it", () => {
    renderControls({ title: "Personal information", saving: true });
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("shows notice and error paragraphs when provided", () => {
    renderControls({
      title: "Personal information",
      notice: "Saved successfully.",
      error: "Validation failed.",
    });
    expect(screen.getByText("Saved successfully.")).toBeInTheDocument();
    expect(screen.getByText("Validation failed.")).toBeInTheDocument();
  });

  it("renders headings per AccountSettings usage (title + section heading)", () => {
    renderControls({ title: "Profile", showSectionHeading: true });
    expect(screen.getByRole("heading", { level: 2, name: "Profile" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Personal information" }),
    ).toBeInTheDocument();
  });

  it("supports the lede paragraph and custom submit label", () => {
    renderControls({
      title: "Personal information",
      lede: "Update the account holder's profile and postal address.",
      submitLabel: "Save profile",
    });
    expect(
      screen.getByText("Update the account holder's profile and postal address."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save profile" }),
    ).toBeInTheDocument();
  });

  it("keeps the admin wrapper class and a typed value", () => {
    const value: PersonalInformationForm = {
      ...EMPTY_PERSONAL_INFORMATION,
      first_name: "Jane",
      address: {
        ...EMPTY_PERSONAL_INFORMATION.address,
        street_address: "1 Main Street",
      },
    };
    renderControls({
      title: "Personal information",
      value,
      className: "user-detail__personal-information",
    });
    expect(screen.getByLabelText("First name")).toHaveValue("Jane");
    expect(screen.getByLabelText("Street")).toHaveValue("1 Main Street");
  });
});