import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { aplicarTokens } from "@jogo/src/shared/styles/tokens";
import { App } from "./App";
import "./estilos.css";

aplicarTokens(document.documentElement);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
