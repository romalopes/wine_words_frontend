// Test setup for Vitest. Registered as `setupFiles` in vite.config.js, so it
// runs once before every test file.
import "@testing-library/jest-dom"
import { vi } from "vitest"

// jsdom does not implement scrollIntoView, so any component that scrolls an
// element into view throws. Components here call it to follow a #hash deep link
// (see CommentSection), so stub it once globally rather than per test file.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn()
}


// Trix detects ElementInternals in jsdom, whose validation method is missing.
// Keep this browser-API shim available to every form test that loads Trix.
if (typeof ElementInternals !== "undefined" && !ElementInternals.prototype.setValidity) {
  Object.defineProperty(ElementInternals.prototype, "setValidity", {
    configurable: true,
    value: vi.fn(),
  });
}

// jsdom does not implement window.matchMedia. Components that read media queries
// (the mobile shell, issue #201) need it to exist; tests override it to simulate
// a phone-width viewport. Defaults to `matches: false` (desktop).
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string): MediaQueryList => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const mediaQueryList = {
      matches: false,
      media: query,
      onchange: null,
      addEventListener: (
        _type: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        listeners.add(listener);
      },
      removeEventListener: (
        _type: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        listeners.delete(listener);
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
    return mediaQueryList as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}
