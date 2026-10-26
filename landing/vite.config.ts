import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const jogo = path.resolve(__dirname, "../frontend");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // A landing usa as cores, a identidade e a logo do próprio jogo, sem copiar nada.
    alias: { "@": path.resolve(__dirname, "./src"), "@jogo": jogo },
    // Os arquivos de frontend/ resolvem o React daqui; no CI o frontend nem tem node_modules.
    dedupe: ["react", "react-dom"],
  },
  server: { port: 1440, strictPort: true, fs: { allow: [__dirname, jogo] } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/configuracao.ts"],
    css: false,
  },
});
