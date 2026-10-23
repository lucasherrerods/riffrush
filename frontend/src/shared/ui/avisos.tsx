import { Toaster } from "sonner";

export { toast as avisar } from "sonner";

/** Avisos rápidos no canto da tela, com as cores do jogo. */
export function Avisos() {
  return (
    <Toaster
      theme="dark"
      position="bottom-center"
      toastOptions={{
        style: {
          background: "var(--cor-superficie-elevada)",
          border: "1px solid var(--cor-borda)",
          color: "var(--cor-texto)",
          fontSize: "16px",
        },
      }}
    />
  );
}
