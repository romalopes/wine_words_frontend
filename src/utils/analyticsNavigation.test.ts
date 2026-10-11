import { getNavigationContext } from "./analyticsNavigation";

describe("analyticsNavigation", () => {
  const originalLocation = window.location;
  const originalDocument = global.document;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location
    const mockLocation = {
      ...originalLocation,
      hostname: "localhost",
      host: "localhost:5173",
      pathname: "/",
      href: "http://localhost:5173/",
    } as Location;
    Object.defineProperty(window, "location", {
      value: mockLocation,
      writable: true,
      configurable: true,
    });

    // Mock document.referrer
    Object.defineProperty(global.document, "referrer", {
      value: "",
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    global.document = originalDocument;
  });

  it("returns direct source when no referrer", () => {
    Object.defineProperty(global.document, "referrer", { value: "", writable: true });
    window.location.pathname = "/articles/123";

    const ctx = getNavigationContext();

    expect(ctx.source).toBe("direct");
    expect(ctx.referrer).toBeUndefined();
  });

  it("detects internal referrer", () => {
    Object.defineProperty(global.document, "referrer", {
      value: "http://localhost:5173/articles",
      writable: true,
    });
    window.location.pathname = "/reviews/456";

    const ctx = getNavigationContext();

    expect(ctx.source).toBe("internal");
    expect(ctx.referrer).toBe("http://localhost:5173/articles");
  });

  it("detects search engine referrer", () => {
    Object.defineProperty(global.document, "referrer", {
      value: "https://www.google.com/search?q=wine",
      writable: true,
    });
    window.location.pathname = "/wines/789";

    const ctx = getNavigationContext();

    expect(ctx.source).toBe("search");
    expect(ctx.referrer).toBe("https://www.google.com/search?q=wine");
  });

  it("detects external referrer", () => {
    Object.defineProperty(global.document, "referrer", {
      value: "https://example.com/blog",
      writable: true,
    });
    window.location.pathname = "/articles/123";

    const ctx = getNavigationContext();

    expect(ctx.source).toBe("external");
    expect(ctx.referrer).toBe("https://example.com/blog");
  });

  it("extracts fromContentType and fromContentId from wine path", () => {
    window.location.pathname = "/wines/chateau-margaux-2015";

    const ctx = getNavigationContext();

    expect(ctx.fromContentType).toBe("Wine");
    expect(ctx.fromContentId).toBe("chateau-margaux-2015");
  });

  it("extracts fromContentType and fromContentId from article path", () => {
    window.location.pathname = "/articles/my-wine-article";

    const ctx = getNavigationContext();

    expect(ctx.fromContentType).toBe("Article");
    expect(ctx.fromContentId).toBe("my-wine-article");
  });

  it("extracts fromContentType and fromContentId from review path", () => {
    window.location.pathname = "/reviews/amazing-wine-review";

    const ctx = getNavigationContext();

    expect(ctx.fromContentType).toBe("Review");
    expect(ctx.fromContentId).toBe("amazing-wine-review");
  });

  it("handles malformed referrer gracefully", () => {
    Object.defineProperty(global.document, "referrer", {
      value: "not-a-url",
      writable: true,
    });
    window.location.pathname = "/wines/test";

    const ctx = getNavigationContext();

    expect(ctx.source).toBe("external");
  });

  it("returns direct source when document undefined", () => {
    // Simulate SSR
    const originalDoc = global.document;
    // @ts-ignore
    global.document = undefined;

    const ctx = getNavigationContext();

    expect(ctx.source).toBe("direct");
    global.document = originalDoc;
  });
});