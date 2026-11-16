import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { aplicarTokens } from "@jogo/src/shared/styles/tokens";
import { PaginaDeNovidades } from "./PaginaDeNovidades";
import "../estilos.css";

aplicarTokens(document.documentElement);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PaginaDeNovidades />
  </StrictMode>,
);
