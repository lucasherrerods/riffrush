import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/** Ícone dentro de um círculo de acerto do osu!: miolo rosa, anel branco e o desenho em branco. */
export function CirculoDeAcerto({ icone: Icone, apagado = false, className }: { icone: LucideIcon; apagado?: boolean; className?: string }) {
  return (
    <span
      data-parte="circulo"
      aria-hidden
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full border-2 border-superficie-elevada bg-primaria text-superficie-elevada ring-1 ring-primaria/40 transition-opacity",
        apagado && "opacity-60",
        className,
      )}
    >
      <Icone className="size-3.5" strokeWidth={2.5} />
    </span>
  );
}
