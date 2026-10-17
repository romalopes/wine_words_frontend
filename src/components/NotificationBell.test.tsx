import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Mock } from "vitest";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import { emitNotificationsChanged } from "../services/notificationEvents";

const mockUnreadCount: Mock = vi.fn();

vi.mock("../services/api", () => ({
  notificationsApi: { unreadCount: () => mockUnreadCount() },
}));

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>,
  );
}

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links to the notifications page", async () => {
    mockUnreadCount.mockResolvedValue({ unread_count: 0 });
    renderBell();

    expect(
      await screen.findByRole("link", { name: /Notifications/ }),
    ).toHaveAttribute("href", "/notifications");
  });

  it("shows the unread count from the dedicated count endpoint", async () => {
    mockUnreadCount.mockResolvedValue({ unread_count: 3 });
    renderBell();

    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(mockUnreadCount).toHaveBeenCalledTimes(1);
  });

  it("shows no badge when everything is read", async () => {
    mockUnreadCount.mockResolvedValue({ unread_count: 0 });
    renderBell();

    await screen.findByRole("link", { name: /Notifications/ });
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("stays usable when the request fails", async () => {
    mockUnreadCount.mockRejectedValue(new Error("unauthorised"));
    renderBell();

    expect(
      await screen.findByRole("link", { name: /Notifications/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("re-checks the count when notifications change elsewhere", async () => {
    // Initially 3 unread, then everything read (e.g. after "Mark all read").
    mockUnreadCount
      .mockResolvedValueOnce({ unread_count: 3 })
      .mockResolvedValue({ unread_count: 0 });
    renderBell();

    expect(await screen.findByText("3")).toBeInTheDocument();

    act(() => {
      emitNotificationsChanged();
    });

    await waitFor(() =>
      expect(screen.queryByText("3")).not.toBeInTheDocument(),
    );
    expect(mockUnreadCount).toHaveBeenCalledTimes(2);
  });

  it("re-checks the count when navigating between pages", async () => {
    const user = userEvent.setup();
    mockUnreadCount.mockResolvedValue({ unread_count: 0 });
    render(
      <MemoryRouter>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <NotificationBell />
                <Link to="/elsewhere">elsewhere</Link>
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("link", { name: /Notifications/ });
    await user.click(screen.getByRole("link", { name: "elsewhere" }));

    await waitFor(() => expect(mockUnreadCount).toHaveBeenCalledTimes(2));
  });
});
