import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { CORES_DO_MULTIPLICADOR, COR_DA_ESTRELA } from "../cores";
import { progressoDoMultiplicador } from "../pista/efeitos";

interface Props {
  pontos: number;
  sequencia: number;
  multiplicador: number;
  /** 0 a 1. */
  precisao: number;
  estrelaAtiva: boolean;
  /** Celular: uma linha só, no topo. */
  compacto?: boolean;
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
export function PainelDePontos({ pontos, sequencia, multiplicador, precisao, estrelaAtiva, compacto = false }: Props) {
  const cor = estrelaAtiva ? COR_DA_ESTRELA : CORES_DO_MULTIPLICADOR[Math.min(3, Math.max(0, multiplicador - 1))];
  const progresso = progressoDoMultiplicador(sequencia);
  const porcentagem = `${Math.round(precisao * 100)}%`;

  const anel = (
    <motion.div
      key={multiplicador}
      initial={{ scale: 1.4 }}
      animate={{ scale: 1 }}
      className={cn("relative grid shrink-0 place-items-center", compacto ? "size-14" : "size-28")}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" role="progressbar" aria-label="Próximo multiplicador" aria-valuenow={Math.round(progresso * 100)} aria-valuemin={0} aria-valuemax={100}>
        <circle cx="50" cy="50" r={RAIO_DO_ANEL} fill="none" strokeWidth="8" className="stroke-superficie-elevada" />
        <circle cx="50" cy="50" r={RAIO_DO_ANEL} fill="none" strokeWidth="8" stroke={cor} strokeDasharray={VOLTA} strokeDashoffset={VOLTA * (1 - progresso)} className="transition-[stroke-dashoffset] duration-150" />
      </svg>
      <span aria-label="Multiplicador" className={cn("font-titulo leading-none tabular-nums", compacto ? "text-2xl" : "text-5xl")} style={{ color: cor }}>
        x{multiplicador}
      </span>
    </motion.div>
  );

  const combo = (
    <div className="flex flex-col leading-none">
      <motion.span
        key={sequencia}
        initial={{ scale: sequencia > 0 ? 1.15 : 1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.12 }}
        aria-label="Sequência"
        className={cn("origin-left font-titulo tabular-nums", compacto ? "text-3xl" : "text-7xl", sequencia >= 25 ? "text-ouro" : "text-texto")}
      >
        {sequencia}
      </motion.span>
      <span className="text-base font-bold tracking-[0.2em] text-texto-suave">COMBO</span>
    </div>
  );

  const pontuacao = (
    <p aria-label="Pontos" className={cn("rounded-sm bg-fundo font-mono leading-none tracking-[0.15em] text-sucesso tabular-nums", compacto ? "px-2 py-1 text-xl" : "px-4 py-2 text-4xl")}>
      {String(Math.round(pontos)).padStart(DIGITOS_DO_VISOR, "0")}
    </p>
  );

  const acerto = (
    <p className="text-base font-bold tracking-[0.1em] text-texto-suave">
      PRECISÃO{" "}
      <span aria-label="Precisão" className={cn("font-titulo text-2xl tracking-normal tabular-nums", corDaPrecisao(precisao))}>
        {porcentagem}
      </span>
    </p>
  );

  if (compacto) {
    return (
      <div className="flex items-center gap-4">
        {anel}
        {combo}
        <div className="flex flex-col gap-1">
          {pontuacao}
          {acerto}
        </div>
      </div>
    );
  }

  return (
    <div className="placa flex flex-col items-center gap-4 p-4">
      {pontuacao}
      <div className="flex items-center gap-4">
        {anel}
        {combo}
      </div>
      {acerto}
    </div>
  );
}
