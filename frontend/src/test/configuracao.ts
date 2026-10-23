import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

// Com a suíte inteira rodando em paralelo, as telas que animam a cada quadro demoram mais que 1 s para responder.
configure({ asyncUtilTimeout: 3000 });

// O jsdom não tem ResizeObserver, que os componentes do Radix usam.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
