import "@testing-library/jest-dom";
import * as matchers from "vitest-axe/matchers";
import { expect } from "vitest";

// Register vitest-axe matchers (toHaveNoViolations).
expect.extend(matchers);

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom doesn't implement these; many UI libs (Radix, sidebar) need them.
if (!window.ResizeObserver) {
  (window as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!window.IntersectionObserver) {
  (window as any).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}
