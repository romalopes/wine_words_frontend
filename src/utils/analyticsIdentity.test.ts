import { getVisitorId, clearVisitorId } from "./analyticsIdentity";

describe("analyticsIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear storage mocks
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    } as unknown as Storage;
    global.sessionStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    } as unknown as Storage;
  });

  describe("getVisitorId", () => {
    it("returns existing visitor ID from localStorage", () => {
      const existingId = "550e8400-e29b-41d4-a716-446655440000";
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(existingId);

      const id = getVisitorId();

      expect(id).toBe(existingId);
      expect(localStorage.getItem).toHaveBeenCalledWith("wine_words_visitor_id");
    });

    it("falls back to sessionStorage when localStorage unavailable", () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Storage unavailable");
      });
      const existingId = "550e8400-e29b-41d4-a716-446655440001";
      (sessionStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(existingId);

      const id = getVisitorId();

      expect(id).toBe(existingId);
      expect(sessionStorage.getItem).toHaveBeenCalledWith("wine_words_visitor_id_session");
    });

    it("generates new UUID when no storage available", () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Storage unavailable");
      });
      (sessionStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Storage unavailable");
      });
      (localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Storage unavailable");
      });
      (sessionStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Storage unavailable");
      });

      const id = getVisitorId();

      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it("persists new ID to localStorage", () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (sessionStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      getVisitorId();

      expect(localStorage.setItem).toHaveBeenCalledWith("wine_words_visitor_id", expect.any(String));
    });
  });

  describe("clearVisitorId", () => {
    it("removes visitor ID from both storages", () => {
      clearVisitorId();

      expect(localStorage.removeItem).toHaveBeenCalledWith("wine_words_visitor_id");
      expect(sessionStorage.removeItem).toHaveBeenCalledWith("wine_words_visitor_id_session");
    });

    it("handles storage errors gracefully", () => {
      (localStorage.removeItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Storage error");
      });
      (sessionStorage.removeItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Storage error");
      });

      expect(() => clearVisitorId()).not.toThrow();
    });
  });
});