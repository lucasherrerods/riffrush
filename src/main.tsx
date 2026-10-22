import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { desbloquearNoPrimeiroToque } from "@/modules/audio";
import { aplicarTokens } from "@/shared/styles/tokens";
import "@/shared/styles/global.css";

aplicarTokens(document.documentElement);
desbloquearNoPrimeiroToque();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
