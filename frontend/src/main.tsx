import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { desbloquearNoPrimeiroToque, instalarAtalhosDeVolume } from "@/modules/audio";
import { aplicarTokens } from "@/shared/styles/tokens";
import "@/shared/styles/global.css";

aplicarTokens(document.documentElement);
desbloquearNoPrimeiroToque();
// Antes das telas: o Alt + roda do volume é ouvido antes de qualquer tela.
instalarAtalhosDeVolume();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
