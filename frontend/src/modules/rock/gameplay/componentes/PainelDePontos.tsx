import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { CORES_DO_MULTIPLICADOR, COR_DA_ESTRELA } from "../cores";
import { progressoDoMultiplicador } from "../pista/efeitos";
import amplificador from "./amplificador.webp";

interface Props {
  pontos: number;
  sequencia: number;
  multiplicador: number;
  /** 0 a 1. */
  precisao: number;
  estrelaAtiva: boolean;
  /** Celular: uma linha só, no topo. */
  compacto?: boolean;
  /** O PERFEITO / ÓTIMO / BOM do último acerto, logo acima da precisão. */
  aviso?: ReactNode;
  /** No modo compacto, o que fica à direita de combo e precisão (ex.: o medidor de rock). */
  lateral?: ReactNode;
}

const RAIO_DO_ANEL = 44;
const VOLTA = 2 * Math.PI * RAIO_DO_ANEL;

/** Cor da precisão (0 a 1): verde acima de 95%, ouro acima de 80%, vermelho abaixo. */
export const corDaPrecisao = (precisao: number) => (precisao >= 0.95 ? "text-sucesso" : precisao >= 0.8 ? "text-ouro" : "text-perigo");
/** O visor de pontos tem 6 dígitos, como num fliperama; uma pontuação maior aparece inteira. */
const DIGITOS_DO_VISOR = 6;

/**
 * Números da partida feitos para ler de relance, num painel de amplificador como no Guitar Hero:
 * o visor digital com os pontos, o anel do multiplicador mostrando quanto falta para o próximo e o combo.
 */
export function PainelDePontos({ pontos, sequencia, multiplicador, precisao, estrelaAtiva, compacto = false, aviso, lateral }: Props) {
  const cor = estrelaAtiva ? COR_DA_ESTRELA : CORES_DO_MULTIPLICADOR[Math.min(3, Math.max(0, multiplicador - 1))];
  const progresso = progressoDoMultiplicador(sequencia);
  const porcentagem = `${Math.round(precisao * 100)}%`;

  const anel = (
    <motion.div
      key={multiplicador}
      initial={{ scale: 1.4 }}
      animate={{ scale: 1 }}
      className={cn("relative grid shrink-0 place-items-center", compacto ? "size-10" : "size-28")}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" role="progressbar" aria-label="Próximo multiplicador" aria-valuenow={Math.round(progresso * 100)} aria-valuemin={0} aria-valuemax={100}>
        <circle cx="50" cy="50" r={RAIO_DO_ANEL} fill="none" strokeWidth="8" className="stroke-superficie-elevada" />
        <circle cx="50" cy="50" r={RAIO_DO_ANEL} fill="none" strokeWidth="8" stroke={cor} strokeDasharray={VOLTA} strokeDashoffset={VOLTA * (1 - progresso)} className="transition-[stroke-dashoffset] duration-150" />
      </svg>
      <span aria-label="Multiplicador" className={cn("font-titulo leading-none tabular-nums", compacto ? "text-lg" : "text-5xl")} style={{ color: cor }}>
        x{multiplicador}
      </span>
    </motion.div>
  );

  const combo = (
    <div className={cn("flex leading-none", compacto ? "items-baseline gap-2" : "flex-col")}>
      <motion.span
        key={sequencia}
        initial={{ scale: sequencia > 0 ? 1.15 : 1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.12 }}
        aria-label="Sequência"
        className={cn("origin-left font-titulo tabular-nums", compacto ? "text-xl" : "text-5xl", sequencia >= 25 ? "text-ouro" : "text-texto")}
      >
        {sequencia}
      </motion.span>
      <span className={cn("font-bold tracking-[0.2em] text-texto-suave", compacto ? "text-xs" : "text-base")}>COMBO</span>
    </div>
  );

  const pontuacao = (
    <div className={cn("relative rounded-sm bg-fundo font-mono leading-none tracking-[0.15em] tabular-nums", compacto ? "px-2 py-0.5 text-base" : "px-4 py-2 text-4xl")}>
      {/* Os segmentos apagados ficam atrás dos acesos, como num display de 7 segmentos. */}
      <span data-testid="segmentos-apagados" aria-hidden className="absolute text-sucesso/10">
        {"8".repeat(Math.max(DIGITOS_DO_VISOR, String(Math.round(pontos)).length))}
      </span>
      <p aria-label="Pontos" className="relative text-sucesso">
        {String(Math.round(pontos)).padStart(DIGITOS_DO_VISOR, "0")}
      </p>
    </div>
  );

  const acerto = (
    <div className="flex flex-col items-start">
      {/* Altura reservada: a linha não pula quando o aviso aparece e some. */}
      <div className={cn("texto-aviso-da-partida", compacto ? "h-5" : "h-7")}>{aviso}</div>
      <p className={cn("font-bold tracking-[0.1em] text-texto-suave", compacto ? "text-xs" : "text-base")}>
        PRECISÃO{" "}
        <span aria-label="Precisão" className={cn("font-titulo tracking-normal tabular-nums", compacto ? "text-base" : "text-2xl", corDaPrecisao(precisao))}>
          {porcentagem}
        </span>
      </p>
    </div>
  );

  if (compacto) {
    return (
      // Celular: a pontuação centralizada logo abaixo do título; combo, precisão e o anel empilhados à esquerda.
      <div className="flex flex-col gap-1">
        <div className="flex justify-center">{pontuacao}</div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col items-start gap-1">
            {combo}
            {acerto}
            {anel}
          </div>
          {lateral}
        </div>
      </div>
    );
  }

  const digitos = String(Math.round(pontos));
  const lcd = (
    <div
      data-testid="lcd"
      className="absolute top-[43%] right-[20%] left-[20%] rounded-sm border-2 border-fundo px-2 py-1 text-center font-mono text-2xl leading-none tracking-[0.1em] tabular-nums"
      style={{ backgroundColor: "color-mix(in srgb, var(--cor-sucesso) 40%, var(--cor-superficie-elevada))" }}
    >
      {/* LCD: dígitos escuros sobre o verde, com os segmentos apagados aparecendo de leve. */}
      <span data-testid="segmentos-apagados" aria-hidden className="absolute inset-x-0 text-fundo/15">
        {"8".repeat(Math.max(DIGITOS_DO_VISOR, digitos.length))}
      </span>
      <p aria-label="Pontos" className="relative text-fundo">
        {digitos.padStart(DIGITOS_DO_VISOR, "0")}
      </p>
    </div>
  );

  // Mostrador redondo de aro dourado; o número brilha laranja como uma válvula nixie.
  const mostrador = (
    <motion.div
      key={multiplicador}
      data-testid="mostrador"
      initial={{ scale: 1.25 }}
      animate={{ scale: 1 }}
      className="absolute top-[55%] left-1/2 grid aspect-square w-[42%] -translate-x-1/2 place-items-center rounded-full border-[5px] border-ouro"
      style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--cor-destaque) 35%, var(--cor-fundo)) 0%, var(--cor-fundo) 72%)" }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" role="progressbar" aria-label="Próximo multiplicador" aria-valuenow={Math.round(progresso * 100)} aria-valuemin={0} aria-valuemax={100}>
        <circle cx="50" cy="50" r={RAIO_DO_ANEL} fill="none" strokeWidth="5" className="stroke-borda" />
        <circle cx="50" cy="50" r={RAIO_DO_ANEL} fill="none" strokeWidth="5" className="stroke-ouro transition-[stroke-dashoffset] duration-150" strokeDasharray={VOLTA} strokeDashoffset={VOLTA * (1 - progresso)} />
      </svg>
      <span aria-label="Multiplicador" className="relative leading-none">
        <span className="absolute top-1/2 -left-10 grid size-6 -translate-y-1/2 place-items-center rounded-full border-2 border-borda bg-superficie-elevada font-titulo text-lg text-texto">
          x
        </span>
        <span data-testid="numero-do-multiplicador" className="font-titulo text-6xl" style={{ color: estrelaAtiva ? COR_DA_ESTRELA : "var(--cor-destaque)" }}>
          {multiplicador}
        </span>
      </span>
    </motion.div>
  );

  return (
    <div className="flex flex-col items-center gap-3">
      {/* A imagem é a moldura; o visor e o mostrador ficam por cima, na grade do alto-falante. */}
      <div data-testid="grade" className="relative aspect-[352/467] w-56">
        <img src={amplificador} alt="" draggable={false} className="absolute inset-0 size-full select-none" />
        {lcd}
        {mostrador}
      </div>
      <div className="flex items-end gap-4">
        {combo}
        {acerto}
      </div>
    </div>
  );
}
