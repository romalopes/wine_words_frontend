import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { analyticsApi } from "../../services/api";
import type {
  SummaryResponse,
  TimeseriesResponse,
  TopContentResponse,
} from "../../services/analyticsApi";
import AnalyticsDashboard from "./AnalyticsDashboard";

let authUser: { id: number; roles: string[] } | null;

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: authUser }),
}));

vi.mock("../../services/api", () => ({
  analyticsApi: {
    reports: {
      summary: vi.fn(),
      topContent: vi.fn(),
      timeseries: vi.fn(),
    },
  },
}));

const period = {
  token: "30d",
  start_at: "2026-10-01T00:00:00Z",
  end_at: "2026-10-30T23:59:59Z",
  timezone: "Australia/Sydney",
  scope_label: "All managed content",
  partial_history: false,
  available_history: {
    from: "2026-01-01T00:00:00Z",
    to: "2026-10-30T23:59:59Z",
  },
  metric_version: "1",
};

const summary: SummaryResponse = {
  views: 1_234,
  unique_viewers: 987,
  likes: 52,
  comments: 18,
  replies: 7,
  engagement_rate: 6.24,
  engagement_denominator_zero: false,
  content_count: 12,
  period,
};

const topContent: TopContentResponse = {
  rows: [
    {
      content_type: "Article",
      content_id: 41,
      title: "Australian Shiraz Today",
      published_at: "2026-10-20T00:00:00Z",
      author_name: "Kasia Sobiesiak",
      views: 720,
      unique_viewers: 610,
      likes: 35,
      comments: 11,
      replies: 4,
      engagement_rate: 6.94,
      engagement_denominator_zero: false,
    },
  ],
  total: 1,
  page: 1,
  per_page: 20,
  sort: "views",
  direction: "desc",
  period,
};

const timeseries = {
  buckets: [
    {
      bucket_start: "2026-10-29T00:00:00Z",
      views: 420,
      unique_viewers: 350,
    },
    {
      bucket_start: "2026-10-30T00:00:00Z",
      views: 814,
      unique_viewers: 637,
    },
  ],
  total_views: 1_234,
  grouping: "day",
  period,
} as unknown as TimeseriesResponse;

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/analytics"]}>
      <Routes>
        <Route path="/analytics" element={<AnalyticsDashboard />} />
        <Route
          path="/analytics/content/:contentType/:contentId"
          element={<div>Content analytics detail</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function mockSuccessfulReports() {
  vi.mocked(analyticsApi.reports.summary).mockResolvedValue(summary);
  vi.mocked(analyticsApi.reports.topContent).mockResolvedValue(topContent);
  vi.mocked(analyticsApi.reports.timeseries).mockResolvedValue(timeseries);
}

describe("AnalyticsDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authUser = { id: 1, roles: ["Admin"] };
    mockSuccessfulReports();
  });

  it("shows the role requirement to users without analytics access", () => {
    authUser = { id: 2, roles: ["Reader"] };

    renderDashboard();

    expect(
      screen.getByRole("heading", { name: "Analytics Access Required" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("You need Reviewer, Editor, or Admin role to view analytics."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Content Analytics" })).not.toBeInTheDocument();
    expect(analyticsApi.reports.summary).not.toHaveBeenCalled();
    expect(analyticsApi.reports.topContent).not.toHaveBeenCalled();
    expect(analyticsApi.reports.timeseries).not.toHaveBeenCalled();
  });

  it("loads the default report and renders KPIs, trending data, and top content", async () => {
    renderDashboard();

    expect(await screen.findByText("Australian Shiraz Today")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Content Analytics" })).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("987")).toBeInTheDocument();
    expect(screen.getByText("6.2")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Views over time (day)" })).toBeInTheDocument();
    expect(screen.getByText("Grouping: day • Total views: 1,234")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wine Insights" })).toHaveAttribute(
      "href",
      "/analytics/wine-insights",
    );

    const defaultParams = {
      period: "30d",
      content_type: "all",
      sort: "views",
      direction: "desc",
      page: 1,
      per_page: 20,
      include_zero_views: true,
      grouping: "day",
    };
    expect(analyticsApi.reports.summary).toHaveBeenCalledExactlyOnceWith(defaultParams);
    expect(analyticsApi.reports.topContent).toHaveBeenCalledExactlyOnceWith(defaultParams);
    expect(analyticsApi.reports.timeseries).toHaveBeenCalledExactlyOnceWith({
      period: "30d",
      grouping: "day",
    });
  });

  it("refetches reports when the period, content type, or zero-view filter changes", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText("Australian Shiraz Today");

    await user.selectOptions(screen.getByLabelText("Reporting period"), "7d");
    await waitFor(() =>
      expect(analyticsApi.reports.summary).toHaveBeenLastCalledWith(
        expect.objectContaining({ period: "7d" }),
      ),
    );

    await user.selectOptions(screen.getByLabelText("Content type filter"), "article");
    await waitFor(() =>
      expect(analyticsApi.reports.topContent).toHaveBeenLastCalledWith(
        expect.objectContaining({ period: "7d", content_type: "article" }),
      ),
    );

    await user.click(screen.getByRole("checkbox", { name: "Include zero-view content" }));
    await waitFor(() =>
      expect(analyticsApi.reports.summary).toHaveBeenLastCalledWith(
        expect.objectContaining({
          period: "7d",
          content_type: "article",
          include_zero_views: false,
        }),
      ),
    );
  });

  it("shows request errors and navigates from a content row to its detail report", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(analyticsApi.reports.summary).mockRejectedValueOnce(
      new Error("Analytics service unavailable"),
    );

    const view = renderDashboard();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Analytics service unavailable",
    );
    expect(consoleError).toHaveBeenCalled();

    mockSuccessfulReports();
    view.unmount();
    renderDashboard();
    const rowTitle = await screen.findByText("Australian Shiraz Today");
    await userEvent.click(rowTitle.closest("tr") as HTMLTableRowElement);

    expect(await screen.findByText("Content analytics detail")).toBeInTheDocument();
  });
});