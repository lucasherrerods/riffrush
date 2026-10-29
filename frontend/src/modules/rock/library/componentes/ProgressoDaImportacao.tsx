import { FileAudio } from "lucide-react";
import { BarraDeProgresso } from "@/shared/ui/BarraDeProgresso";
import type { Progresso } from "../importacao";

/** Barra fixa embaixo da tela enquanto os arquivos são lidos. */
export function ProgressoDaImportacao({ progresso }: { progresso: Progresso | null }) {
  if (!progresso) return null;
  return (
    <div className="chapa fixed bottom-24 left-1/2 z-40 flex w-96 max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col gap-2 bg-superficie-elevada p-4">
      <div className="flex items-center gap-2">
        <FileAudio className="size-4 text-destaque opacity-70" />
        <span className="font-titulo text-xl tracking-wide uppercase">Importando</span>
        <span className="flex-1" />
        <span className="font-mono text-base text-texto-suave">{Math.min(progresso.concluidos + 1, progresso.total)} de {progresso.total}</span>
      </div>
      <p className="truncate text-base text-texto-suave">{progresso.atual}</p>
      <BarraDeProgresso fracao={progresso.fracao} rotulo="Importando músicas" />
    </div>
  );
}
