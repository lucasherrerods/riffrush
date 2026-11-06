import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface Props {
  nome: string;
  marcada: boolean;
  aoEscolher: () => void;
  /** A miniatura da skin. */
  amostra: ReactNode;
  /** Só nas skins que o jogador importou. */
  aoApagar?: () => void;
}

/** Uma opção de skin num grupo de rádio: miniatura em cima, nome embaixo. */
export function CartaoDeSkin({ nome, marcada, aoEscolher, amostra, aoApagar }: Props) {
  return (
    <div className="relative">
      <button
        role="radio"
        aria-checked={marcada}
        aria-label={nome}
        onClick={aoEscolher}
        className={cn("flex w-full flex-col gap-2 rounded-lg border-2 bg-superficie p-2 text-left transition-colors hover:bg-superficie-hover", marcada ? "border-primaria" : "border-borda")}
      >
        {amostra}
        <span className={cn("truncate text-sm font-semibold", marcada ? "text-texto" : "text-texto-suave")}>{nome}</span>
      </button>
      {aoApagar && (
        <button aria-label={`Apagar ${nome}`} onClick={aoApagar} className="absolute top-3 right-3 rounded-md bg-fundo/80 p-1 text-texto-suave hover:text-perigo">
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}

export const GRADE_DE_SKINS = "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4";
