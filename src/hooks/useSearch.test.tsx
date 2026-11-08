import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { useSearch } from "./useSearch";
import type { SearchParams } from "../services/searchParams";

// `/reviews` and `/articles` both hand the hook these defaults. The hook used to
// write every one of them back to the address bar on mount, so a pristine
// listing showed up as `?page=1&per_page=20&sort=relevance`. These tests pin the
// rule that only values differing from a default belong in the URL — the params
// themselves still reach the fetcher, so the request is unchanged.
const DEFAULTS: SearchParams = {
  page: 1,
  per_page: 20,
  sort: "relevance",
  query: "",
};

function router(initialEntry = "/reviews") {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
    );
  };
}

/** The one-page envelope the Rails list endpoints hand back. */
function envelope() {
  return {
    items: [{ id: 1 }],
    page: 1,
    per_page: 20,
    total_count: 1,
    total_pages: 1,
  };
}

function renderSearch() {
  const fetcher = vi.fn(async (_params: SearchParams) => envelope());
  const view = renderHook(() => useSearch(fetcher, DEFAULTS), {
    wrapper: router(),
  });
  return { ...view, fetcher };
}

/** The address bar exactly as the hook left it. */
function urlSearch(): string {
  return window.location.search;
}

describe("useSearch URL sync", () => {
  // The hook reads and writes `window.location` directly (it is the single
  // owner of these keys), so every test starts from a pristine listing URL.
  beforeEach(() => {
    window.history.replaceState({}, "", "/reviews");
  });

  it("leaves the address bar empty while every param is still its default", async () => {
    const { fetcher } = renderSearch();

    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(urlSearch()).toBe("");
    // The defaults are still what the API is asked for.
    expect(fetcher.mock.calls[0]?.[0]).toMatchObject({
      page: 1,
      per_page: 20,
      sort: "relevance",
    });
  });

  it("writes a param once it differs from the default", async () => {
    const { result, fetcher } = renderSearch();
    await waitFor(() => expect(fetcher).toHaveBeenCalled());

    await act(async () => result.current.setSort("recent"));
    await waitFor(() => expect(urlSearch()).toBe("?sort=recent"));

    await act(async () => result.current.setPage(2));
    await waitFor(() => expect(urlSearch()).toBe("?page=2&sort=recent"));
  });

  it("drops a param again when it goes back to its default", async () => {
    const { result, fetcher } = renderSearch();
    await waitFor(() => expect(fetcher).toHaveBeenCalled());

    await act(async () => result.current.setSort("recent"));
    await waitFor(() => expect(urlSearch()).toBe("?sort=recent"));

    await act(async () => result.current.setSort("relevance"));
    await waitFor(() => expect(urlSearch()).toBe(""));

    await act(async () => result.current.setPage(3));
    await waitFor(() => expect(urlSearch()).toBe("?page=3"));

    // Page 1 is the default, so paginating back to the first page cleans up.
    await act(async () => result.current.setPage(1));
    await waitFor(() => expect(urlSearch()).toBe(""));
  });

  it("removes a filter from the URL when the filter is removed", async () => {
    const { result, fetcher } = renderSearch();
    await waitFor(() => expect(fetcher).toHaveBeenCalled());

    await act(async () => result.current.setFilter("status", "draft"));
    await waitFor(() => expect(urlSearch()).toBe("?status=draft"));

    // `removeFilter` drops the key from `params` entirely, so only the hook's
    // memory of what it wrote can clean it out of the URL.
    await act(async () => result.current.removeFilter("status"));
    await waitFor(() => expect(urlSearch()).toBe(""));
  });

  it("keeps a deep link whose values differ from the defaults", async () => {
    window.history.replaceState({}, "", "/reviews?page=2&per_page=50");
    const { fetcher } = renderSearch();

    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(fetcher.mock.calls[0]?.[0]).toMatchObject({ page: 2, per_page: 50 });
    expect(urlSearch()).toBe("?page=2&per_page=50");
  });
});
