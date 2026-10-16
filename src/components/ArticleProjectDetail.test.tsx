import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ApiError } from "../services/ApiError";
import ArticleProjectDetail from "./ArticleProjectDetail";

const show = vi.fn();
const destroy = vi.fn();
const createReviewFromNotebook = vi.fn();
const updateNotebook = vi.fn();
const update = vi.fn();

vi.mock("../services/api", () => ({
  articleProjectsApi: {
    show: (...args: unknown[]) => show(...args),
    destroy: (...args: unknown[]) => destroy(...args),
    createReviewFromNotebook: (...args: unknown[]) =>
      createReviewFromNotebook(...args),
    updateNotebook: (...args: unknown[]) => updateNotebook(...args),
    update: (...args: unknown[]) => update(...args),
  },
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 4, roles: ["Reviewer"] } }),
}));
vi.mock("./ArticleProjectForm", () => ({
  default: ({
    activeTab,
    embedded,
    onSaved,
  }: {
    activeTab?: string;
    embedded?: boolean;
    onSaved?: (project: unknown) => void;
  }) => (
    <>
      <p>Article Project form: {activeTab ?? "standalone"}</p>
      {embedded && <p>Embedded workspace form</p>}
      {onSaved && (
        <button type="button" onClick={() => onSaved(project)}>
          Save mocked Article Project
        </button>
      )}
    </>
  ),
}));
vi.mock("./ArticleForm", () => ({
  default: ({
    onSaved,
    onCancel,
  }: {
    onSaved: (article: { id: number; title: string; status: string }) => void;
    onCancel?: () => void;
  }) => (
    <>
      <p>New Article form</p>
      <button
        type="button"
        onClick={() =>
          onSaved({ id: 42, title: "New Barolo story", status: "draft" })
        }
      >
        Save mocked Article
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel}>
          Cancel mocked Article
        </button>
      )}
    </>
  ),
}));

const project = {
  id: 9,
  name: "Barolo feature",
  publication: "Wine Journal",
  editor_name: null,
  editor_email: null,
  project_status: "planning",
  drafting_status: "initiated",
  deadline: null,
  target_word_count: 1200,
  overdue: false,
  lock_version: 0,
  created_by: { id: 4, display_name: "Reviewer" },
  counts: { total: 0, requested: 0, received: 0, selected: 0, tasted: 0 },
  description: null,
  actual_word_count: null,
  word_count_remaining: null,
  created_at: null,
  updated_at: null,
  article: null,
  article_project_producers: [],
  article_project_vintages: [],
  article_project_reviews: [],
};

function renderAt(path: string) {
  function Location() {
    const location = useLocation();
    return (
      <output data-testid="location">
        {location.pathname}
        {location.search}
      </output>
    );
  }
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Location />
      <Routes>
        <Route
          path="/article-projects/:id"
          element={<ArticleProjectDetail />}
        />
        <Route
          path="/article-projects/:id/edit"
          element={<ArticleProjectDetail />}
        />
        <Route path="/article-projects" element={<p>Article Project list</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ArticleProjectDetail", () => {
  beforeEach(() => {
    show.mockReset();
    destroy.mockReset();
    createReviewFromNotebook.mockReset();
    updateNotebook.mockReset();
    update.mockReset();
    show.mockResolvedValue(project);
    update.mockResolvedValue(project);
  });

  it("renders the workspace tabs and form directly from the edit route", async () => {
    renderAt("/article-projects/9/edit");
    expect(
      await screen.findByText("Article Project form: overview"),
    ).toBeInTheDocument();
    expect(screen.getByText("Embedded workspace form")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Article" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Wines & Notes" }),
    ).toBeInTheDocument();
  });

  it("keeps the selected workspace tab on the edit route and returns to it after save", async () => {
    const user = userEvent.setup();
    renderAt("/article-projects/9/edit?tab=wines-notes");

    expect(
      await screen.findByRole("tab", { name: "Wines & Notes" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByText("Article Project form: wines-notes"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/article-projects/9/edit?tab=wines-notes",
    );

    await user.click(screen.getByRole("tab", { name: "Article" }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/article-projects/9/edit?tab=article",
    );
    expect(
      screen.getByText("Article Project form: article"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Save mocked Article Project" }),
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/article-projects/9?tab=article",
    );
  });

  it("switches to edit mode after clicking the Edit button", async () => {
    const user = userEvent.setup();
    renderAt("/article-projects/9?tab=wines-notes");

    await user.click(
      await screen.findByRole("button", { name: "Edit Article Project" }),
    );

    expect(
      await screen.findByText("Article Project form: wines-notes"),
    ).toBeInTheDocument();
  });

  it("uses the tab query parameter and supports keyboard tab navigation", async () => {
    const user = userEvent.setup();
    renderAt("/article-projects/9?tab=article");

    const articleTab = await screen.findByRole("tab", { name: "Article" });
    expect(articleTab).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByText("No article is linked to this project yet."),
    ).toBeInTheDocument();

    articleTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Wines & Notes" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("No wines linked.")).toBeInTheDocument();
  });

  it("creates an Article draft and links it to the project", async () => {
    const user = userEvent.setup();
    renderAt("/article-projects/9?tab=article");

    await user.click(
      await screen.findByRole("button", { name: "Create new Article" }),
    );
    expect(screen.getByText("New Article form")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Save mocked Article" }),
    );
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(9, {
        article_id: 42,
        lock_version: 0,
      }),
    );
    expect(show).toHaveBeenCalledTimes(2);
  });

  it("offers a retry when an Article draft is created but cannot be linked", async () => {
    const user = userEvent.setup();
    update.mockRejectedValueOnce(new Error("Link failed"));
    renderAt("/article-projects/9?tab=article");

    await user.click(
      await screen.findByRole("button", { name: "Create new Article" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Save mocked Article" }),
    );

    expect(
      await screen.findByRole("button", { name: "Retry linking Article" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/New Barolo story.*created but is not linked/i),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Retry linking Article" }),
    );
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
  });

  it("confirms deletion, calls the API, and redirects to the list", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    destroy.mockResolvedValue(undefined);
    renderAt("/article-projects/9?tab=wines-notes");
    await user.click(
      await screen.findByRole("button", { name: "Delete Article Project" }),
    );
    await waitFor(() => expect(destroy).toHaveBeenCalledWith(9));
    expect(confirm).toHaveBeenCalled();
    expect(await screen.findByText("Article Project list")).toBeInTheDocument();
    confirm.mockRestore();
  });

  it("creates a draft review from a notebook in the existing detail page", async () => {
    const user = userEvent.setup();
    const projectWithNotebook = {
      ...project,
      counts: { ...project.counts, total: 1 },
      article_project_vintages: [
        {
          id: 14,
          vintage: {
            id: 8,
            display_name: "Barolo 2022",
            year: 2022,
            wine_name: "Barolo",
            wine_slug: "barolo",
            producer_id: 3,
          },
          requested: false,
          received: false,
          selected: false,
          tasted: true,
          date_received: null,
          bottle_condition: "not_assessed",
          notes: null,
          article_project_notebooks: [
            {
              id: 25,
              title: "Tasting notes",
              content: "Rose and cherry",
              position: 0,
              lock_version: 0,
            },
          ],
        },
      ],
    };
    show.mockResolvedValue(projectWithNotebook);
    createReviewFromNotebook.mockResolvedValue({
      id: 31,
      slug: "tasting-notes",
      title: "Tasting notes",
      status: "draft",
      vintage_id: 8,
      vintage_year: 2022,
      wine_name: "Barolo",
    });

    renderAt("/article-projects/9?tab=wines-notes");
    await user.click(
      await screen.findByRole("button", { name: "Create draft review" }),
    );

    await waitFor(() =>
      expect(createReviewFromNotebook).toHaveBeenCalledWith(9, 14, 25),
    );
    expect(await screen.findByText("Edit draft review")).toBeInTheDocument();
  });

  it("retains notebook edits and offers reload after an optimistic-lock conflict", async () => {
    const user = userEvent.setup();
    const projectWithNotebook = {
      ...project,
      counts: { ...project.counts, total: 1 },
      article_project_vintages: [
        {
          id: 14,
          vintage: {
            id: 8,
            display_name: "Barolo 2022",
            year: 2022,
            wine_name: "Barolo",
            wine_slug: "barolo",
            producer_id: 3,
          },
          requested: false,
          received: false,
          selected: false,
          tasted: true,
          date_received: null,
          bottle_condition: "not_assessed",
          notes: null,
          article_project_notebooks: [
            {
              id: 25,
              title: "Tasting notes",
              content: "Rose and cherry",
              position: 0,
              lock_version: 0,
            },
          ],
        },
      ],
    };
    show.mockResolvedValue(projectWithNotebook);
    updateNotebook.mockRejectedValue(
      new ApiError("Notebook has changed. Reload and try again.", 409, {}),
    );

    renderAt("/article-projects/9?tab=wines-notes");
    await user.click(
      await screen.findByRole("button", { name: "Edit notebook" }),
    );
    const title = screen.getByLabelText("Notebook title");
    await user.clear(title);
    await user.type(title, "Unsaved tasting notes");
    await user.click(screen.getByRole("button", { name: "Save notebook" }));

    expect(
      await screen.findByText("Your unsaved notebook changes are still here."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reload notebook" }),
    ).toBeInTheDocument();
    expect(title).toHaveValue("Unsaved tasting notes");
    expect(updateNotebook).toHaveBeenCalledWith(
      9,
      14,
      25,
      expect.objectContaining({ lock_version: 0 }),
    );
  });
});
