import { Loader2 } from "lucide-react";

/** Enquanto o código de uma tela adiada chega (ver `shared/lib/adiar`). */
export function TelaCarregando() {
  return (
    <div role="status" aria-label="Carregando" className="absolute inset-0 grid place-items-center">
      <Loader2 className="size-10 animate-spin text-primaria" aria-hidden />
    </div>
  );
}
