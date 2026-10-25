import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Mock } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Notifications from "./Notifications";
import { onNotificationsChanged } from "../services/notificationEvents";
import type { QueryParams } from "../types/common";

const mockList: Mock = vi.fn();
const mockMarkRead: Mock = vi.fn();
const mockMarkAllRead: Mock = vi.fn();

vi.mock("../services/api", () => ({
  notificationsApi: {
    list: (params?: QueryParams) => mockList(params),
    markRead: (id: string | number) => mockMarkRead(id),
    markAllRead: () => mockMarkAllRead(),
  },
  winePackagesApi: { list: vi.fn(), show: vi.fn() },
  winePackageItemsApi: { create: vi.fn(), update: vi.fn(), destroy: vi.fn() },
  shipmentTrackingsApi: { show: vi.fn() },
  winesApi: { search: vi.fn() },
  producersApi: { list: vi.fn() },
  usersApi: { search: vi.fn() },
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, display_name: "Reviewer", roles: ["Editor"] },
    loading: false,
  }),
}));

const notification = {
  id: 21,
  notification_type: "wine_package_deadline",
  message:
    "Penfolds: 2 review(s) still pending; the review deadline is in 5 days (2026-10-01).",
  wine_package_id: 7,
  producer_name: "Penfolds",
  package_status: "arrived",
  scheduled_date: "2026-09-26",
  sent_at: null,
  read_at: null,
  sent: false,
  read: false,
  created_at: "2026-09-18T09:00:00Z",
};

function renderNotifications() {
  return render(
    <MemoryRouter>
      <Notifications />
    </MemoryRouter>,
  );
}

describe("Notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({
      items: [notification],
      page: 1,
      per_page: 20,
      total_count: 1,
      total_pages: 1,
    });
    mockMarkRead.mockResolvedValue({ ...notification, read: true });
    mockMarkAllRead.mockResolvedValue({ marked: 1 });
  });

  it("lists the reminder with a link back to its package", async () => {
    renderNotifications();

    expect(
      await screen.findByText(/2 review\(s\) still pending/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Penfolds" })).toHaveAttribute(
      "href",
      "/wine-packages/7",
    );
    expect(screen.getByText("Unread")).toBeInTheDocument();
    expect(screen.getByText("not sent yet")).toBeInTheDocument();
  });

  it("marks one notification read and reloads the list", async () => {
    const user = userEvent.setup();
    renderNotifications();

    await user.click(await screen.findByRole("button", { name: "Mark read" }));

    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith(21));
    expect(mockList).toHaveBeenCalledTimes(2);
  });

  it("marks every notification read", async () => {
    const user = userEvent.setup();
    renderNotifications();

    await user.click(
      await screen.findByRole("button", { name: "Mark all read" }),
    );

    await waitFor(() => expect(mockMarkAllRead).toHaveBeenCalled());
  });

  it("tells the header bell after marking one notification read", async () => {
    const user = userEvent.setup();
    const listener = vi.fn();
    const unsubscribe = onNotificationsChanged(listener);
    renderNotifications();

    try {
      await user.click(
        await screen.findByRole("button", { name: "Mark read" }),
      );
      await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    } finally {
      unsubscribe();
    }
  });

  it("tells the header bell after marking all read", async () => {
    const user = userEvent.setup();
    const listener = vi.fn();
    const unsubscribe = onNotificationsChanged(listener);
    renderNotifications();

    try {
      await user.click(
        await screen.findByRole("button", { name: "Mark all read" }),
      );
      await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    } finally {
      unsubscribe();
    }
  });

  it("filters to unread notifications", async () => {
    const user = userEvent.setup();
    renderNotifications();

    await screen.findByText(/2 review\(s\) still pending/);
    await user.click(screen.getByLabelText("Unread only"));

    await waitFor(() =>
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ unread: "true" }),
      ),
    );
  });

  it("renders follow-based notifications with a link to the changed content", async () => {
    const followNotification = {
      id: 30,
      notification_type: "review_published",
      message: "Review published: Grange 2020",
      wine_package_id: null,
      producer_name: null,
      package_status: null,
      notification_event_id: 5,
      event_type: "review.published",
      actor_name: "Rene Lopes",
      target_path: "/reviews/grange-2020",
      target_label: "Grange 2020",
      scheduled_date: "2026-10-24",
      delivered_at: "2026-10-24T09:00:00Z",
      sent_at: null,
      read_at: null,
      sent: false,
      read: false,
      created_at: "2026-10-24T09:00:00Z",
    };
    mockList.mockResolvedValue({
      items: [followNotification],
      page: 1,
      per_page: 20,
      total_count: 1,
      total_pages: 1,
    });
    renderNotifications();

    expect(await screen.findByText(/Review published: Grange 2020/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Grange 2020" })).toHaveAttribute(
      "href",
      "/reviews/grange-2020",
    );
    // Follow notifications are in-app only: no "not sent yet" noise.
    expect(screen.queryByText("not sent yet")).not.toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    mockList.mockResolvedValue({
      items: [],
      page: 1,
      per_page: 20,
      total_count: 0,
      total_pages: 0,
    });
    renderNotifications();

    expect(await screen.findByText(/No notifications yet/)).toBeInTheDocument();
  });
});
