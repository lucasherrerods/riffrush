import { Loader2 } from "lucide-react";

/** A espera antes da partida, igual nos dois modos: o que está acontecendo e qual música vem. */
export function CarregandoPartida({ mensagem, titulo, detalhe }: { mensagem: string; titulo: string; detalhe: string }) {
  return (
    <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
      <Loader2 className="size-10 animate-spin text-primaria" aria-hidden />
      <p className="text-lg font-semibold">{mensagem}</p>
      <p className="text-base text-texto-suave">
        {titulo} · {detalhe}
      </p>
    </div>
  );
}
