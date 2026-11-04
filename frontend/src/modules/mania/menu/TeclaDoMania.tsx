import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/**
 * Ícone dentro de uma tecla do mania: o receptor da coluna, rosa, com o desenho em branco
 * e a faixa branca da linha de julgamento embaixo, como uma nota chegando na tecla.
 */
export function TeclaDoMania({ icone: Icone, apagado = false, className }: { icone: LucideIcon; apagado?: boolean; className?: string }) {
  return (
    <span
      data-parte="tecla"
      aria-hidden
      className={cn(
        "relative grid h-7 w-6 shrink-0 place-items-center overflow-hidden rounded-[4px] border border-texto/70 bg-primaria pb-1 text-texto transition-opacity",
        apagado && "opacity-60",
        className,
      )}
    >
      <Icone className="size-3.5" strokeWidth={2.5} />
      <span className="absolute inset-x-0 bottom-0 h-1 bg-texto" />
    </span>
  );
}
