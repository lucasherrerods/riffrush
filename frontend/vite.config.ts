import path from "node:path";
import process from "node:process";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { CHAVE_DO_MODO } from "./src/shared/modo";
import { scriptDoFundoInicial } from "./src/shared/styles/fundoInicial";
import { TEMAS } from "./src/shared/styles/temas";
import { IDENTIDADE_DO_MANIA } from "./src/modules/mania/identidade";
import { IDENTIDADE_DO_ROCK } from "./src/modules/rock/identidade";

/** Pinta o fundo do modo salvo no primeiro quadro, antes do JS do app: sem isso a página abre branca. */
const fundoInicial = {
  name: "fundo-inicial",
  transformIndexHtml: () => [
    {
      tag: "script",
      injectTo: "head-prepend" as const,
      children: scriptDoFundoInicial({ rock: TEMAS[IDENTIDADE_DO_ROCK.tema].cores.fundo, mania: TEMAS[IDENTIDADE_DO_MANIA.tema].cores.fundo }, CHAVE_DO_MODO),
    },
  ],
};

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss(), fundoInicial],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  // O Tauri espera uma porta fixa e não deve esconder os erros do Rust.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/configuracao.ts"],
    css: false,
    // Os testes não usam o .env da máquina: sem isso, quem tem a API configurada roda os testes contra a API real.
    env: { VITE_URL_DA_API: "", VITE_URL_DO_RELAY: "", VITE_GOOGLE_CLIENT_ID: "", VITE_GOOGLE_CLIENT_ID_DESKTOP: "" },
  },
});
