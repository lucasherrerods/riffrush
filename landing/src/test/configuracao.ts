import "@testing-library/jest-dom/vitest";

// O jsdom não tem canvas nem IntersectionObserver; a pista e as animações só precisam existir.
HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as never;
