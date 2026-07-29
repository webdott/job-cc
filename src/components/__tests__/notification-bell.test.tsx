/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationBell } from "@/components/notification-bell";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function renderBell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationBell />
    </QueryClientProvider>
  );
}

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response);
}

describe("NotificationBell", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the unread count badge from the API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        jsonResponse({
          notifications: [
            {
              id: "n1",
              type: "job_match",
              title: "New match",
              body: "A job matched your resume",
              url: null,
              readAt: null,
              createdAt: new Date().toISOString(),
            },
          ],
          unreadCount: 1,
        })
      )
    );

    renderBell();

    expect(await screen.findByText("1")).toBeInTheDocument();
  });

  it("caps the badge display at 9+", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => jsonResponse({ notifications: [], unreadCount: 15 }))
    );

    renderBell();

    expect(await screen.findByText("9+")).toBeInTheDocument();
  });

  it("opens the panel, marks a notification read, and navigates to its url on click", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/notifications" && (!init || init.method === undefined)) {
        return jsonResponse({
          notifications: [
            {
              id: "n1",
              type: "job_match",
              title: "New match",
              body: "A job matched your resume",
              url: "/pipeline",
              readAt: null,
              createdAt: new Date().toISOString(),
            },
          ],
          unreadCount: 1,
        });
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    const notificationButton = await screen.findByText("New match");
    await user.click(notificationButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/notifications/n1", { method: "PATCH" });
    });
    expect(pushMock).toHaveBeenCalledWith("/pipeline");
  });

  it("shows an empty state when there are no notifications", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => jsonResponse({ notifications: [], unreadCount: 0 }))
    );

    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByText("No notifications yet.")).toBeInTheDocument();
  });
});
