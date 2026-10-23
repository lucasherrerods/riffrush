import { FileAudio } from "lucide-react";
import type { Progresso } from "../importacao";

/** Barra fixa embaixo da tela enquanto os arquivos são lidos. */
export function ProgressoDaImportacao({ progresso }: { progresso: Progresso | null }) {
  if (!progresso) return null;
  const porcentagem = Math.round(progresso.fracao * 100);
  return (
    <div className="chapa fixed bottom-24 left-1/2 z-40 flex w-96 max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col gap-2 bg-superficie-elevada p-4">
      <div className="flex items-center gap-2">
        <FileAudio className="size-4 text-destaque opacity-70" />
        <span className="font-titulo text-xl tracking-wide uppercase">Importando</span>
        <span className="flex-1" />
        <span className="font-mono text-base text-texto-suave">{Math.min(progresso.concluidos + 1, progresso.total)} de {progresso.total}</span>
      </div>
      <p className="truncate text-base text-texto-suave">{progresso.atual}</p>
      <div
        role="progressbar"
        aria-label="Importando músicas"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={porcentagem}
        className="h-2 overflow-hidden rounded-sm bg-superficie"
      >
        <div className="h-full bg-primaria transition-[width] duration-150" style={{ width: `${porcentagem}%` }} />
      </div>
    </div>
  );
}
