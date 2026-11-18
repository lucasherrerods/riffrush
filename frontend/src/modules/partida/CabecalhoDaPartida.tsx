import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { comoPorcentagem, corDaPrecisao } from "./precisao";

interface Props {
  titulo: string;
  artista?: string;
  /** Dificuldade (e instrumento), embaixo do artista. */
  detalhe: string;
  /** A capa já montada pelo modo. */
  capa: ReactNode;
  /** Etiquetas ao lado do detalhe: REPLAY, TREINO, BOT... */
  selos?: ReactNode;
  /** Botões do canto direito (pausar, trocar trecho). */
  acoes?: ReactNode;
  /** 0 a 1. */
  precisao: number;
  /** 0 a 1. */
  progresso: number;
  /** No replay e no treino a barra de progresso também leva a partida para aquele ponto. */
  aoIrPara?: (fracao: number) => void;
  /** Celular: o centro desce para uma linha própria. */
  compacto?: boolean;
}

/**
 * O topo da partida, igual no Rock e no Mania: a música no canto esquerdo;
 * à direita a precisão e o progresso da música, ao lado dos botões.
 */
export function CabecalhoDaPartida({ titulo, artista, detalhe, capa, selos, acoes, precisao, progresso, aoIrPara, compacto = false }: Props) {
  return (
    <header
      className={cn("pointer-events-none absolute inset-x-0 top-0 grid items-start", compacto ? "grid-cols-[minmax(0,1fr)_auto] gap-2 px-3 pt-2" : "grid-cols-[minmax(0,1fr)_auto] gap-6 px-6 pt-4")}
    >
      <div data-testid="info-da-musica" className="flex min-w-0 items-center gap-3">
        <div className={cn("shrink-0 overflow-hidden rounded-md border border-borda", compacto ? "size-10" : "size-16")}>{capa}</div>
        <div className="min-w-0">
          <h1 className="texto-titulo-da-partida truncate font-bold">{titulo}</h1>
          {artista && <p className={cn("truncate text-texto-suave", compacto ? "text-xs" : "text-base")}>{artista}</p>}
          <p className={cn("pointer-events-auto flex min-w-0 flex-wrap items-center gap-2 text-texto-suave", compacto ? "text-xs" : "text-sm")}>
            <span className="truncate">{detalhe}</span>
            {selos}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <div data-testid="direita-do-topo" className={cn("flex flex-col items-end gap-1", compacto ? "w-28" : "w-64")}>
          <p aria-label="Precisão" className={cn("font-titulo leading-none tabular-nums", compacto ? "text-xl" : "text-3xl", corDaPrecisao(precisao))}>
            {comoPorcentagem(precisao)}
          </p>
          <div className={cn("pointer-events-auto relative w-full", aoIrPara && "py-1")}>
            <div className="h-1.5 overflow-hidden rounded-full bg-superficie-elevada" aria-label="Progresso da música">
              <div className="h-full bg-primaria" style={{ width: `${progresso * 100}%` }} />
            </div>
            {aoIrPara && (
              <input
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={progresso}
                onChange={(e) => aoIrPara(Number(e.target.value))}
                // As teclas são do jogo (o Esc pausa): a barra não fica com o foco depois do clique.
                onPointerUp={(e) => e.currentTarget.blur()}
                aria-label="Posição da música"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            )}
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">{acoes}</div>
      </div>
    </header>
  );
}
