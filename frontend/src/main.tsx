import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { desbloquearNoPrimeiroToque, instalarAtalhosDeVolume } from "@/modules/audio";
import { iniciarMotor } from "@/modules/gameplay";
import { aplicarTokens } from "@/shared/styles/tokens";
import "@/shared/styles/global.css";

aplicarTokens(document.documentElement);
desbloquearNoPrimeiroToque();
// Antes das telas: o Alt + roda do volume é ouvido antes de qualquer tela.
instalarAtalhosDeVolume();

// O motor da partida é WASM (o mesmo da API): 41 KB que carregam antes da primeira tela.
void iniciarMotor().then(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
