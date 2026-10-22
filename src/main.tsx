import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { aplicarTokens } from "@/compartilhado/estilos/tokens";
import "@/compartilhado/estilos/global.css";

aplicarTokens(document.documentElement);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
