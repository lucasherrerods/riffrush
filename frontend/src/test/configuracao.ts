import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach } from "vitest";
import { iniciarMotorComBytes } from "@/modules/rock/gameplay/partida";

afterEach(() => cleanup());

// Com a suíte inteira rodando em paralelo, as telas que animam a cada quadro demoram mais que 1 s para responder.
configure({ asyncUtilTimeout: 3000 });

// O jsdom não tem ResizeObserver, que os componentes do Radix usam.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// O motor da partida é WASM: no app ele carrega por fetch; aqui, direto do arquivo.
iniciarMotorComBytes(readFileSync(resolve(process.cwd(), "src/modules/rock/gameplay/wasm/motor_bg.wasm")));
