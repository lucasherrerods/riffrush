import { cn } from "@/shared/lib/utils";
import { COR_DA_NOTA, notaDaPrecisao } from "./nota";

/** A nota (SS, S, A...) que a precisão vale, como no osu!mania. */
export function SeloDaNota({ precisao, className }: { precisao: number; className?: string }) {
  const nota = notaDaPrecisao(precisao);
  return (
    <span aria-label={`Nota ${nota}`} className={cn("inline-block w-8 shrink-0 text-center font-titulo text-xl leading-none", COR_DA_NOTA[nota], className)}>
      {nota}
    </span>
  );
}
