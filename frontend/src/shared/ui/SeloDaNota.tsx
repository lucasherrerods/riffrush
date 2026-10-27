import type { CSSProperties } from "react";
import { cn } from "@/shared/lib/utils";
import { estiloDaNota, notaDaPrecisao } from "@/shared/lib/nota";

/** A nota (SS, S, A...) que a precisão vale, como emblema metálico que chama mais atenção quanto mais alta. */
export function SeloDaNota({ precisao, className }: { precisao: number; className?: string }) {
  const nota = notaDaPrecisao(precisao);
  const estilo = estiloDaNota(nota);
  return (
    <span
      aria-label={`Nota ${nota}`}
      data-nota={nota}
      style={{ "--intensidade": estilo.intensidade, "--escala": estilo.escala } as CSSProperties}
      className={cn("selo-da-nota text-3xl", estilo.aro && "selo-da-nota-aro", estilo.brilho && "selo-da-nota-brilho", className)}
    >
      <span className="selo-da-nota-letra">{nota}</span>
    </span>
  );
}
