import { NOME_DO_MODO, type Modo } from "@/shared/modo";
import { TEMAS, estiloDoTema } from "@/shared/styles/tokens";
import { cn } from "@/shared/lib/utils";

const TEMA_DO_MODO = { rock: TEMAS.riffRush, mania: TEMAS.mania } as const;

/** "Rock" ou "Mania" nas cores do próprio modo, para ler igual dentro de qualquer um dos dois temas. */
export function EtiquetaDeModo({ modo, className }: { modo: Modo; className?: string }) {
  return (
    <span
      style={estiloDoTema(TEMA_DO_MODO[modo])}
      className={cn("inline-flex shrink-0 items-center rounded-sm bg-primaria px-1.5 font-titulo text-xs leading-5 tracking-wide text-texto uppercase", className)}
    >
      {NOME_DO_MODO[modo]}
    </span>
  );
}
