import { cn } from "@/shared/lib/utils";
import type { Julgamento } from "../partida";
import { DURACAO_DO_JULGAMENTO, estiloDoJulgamento } from "../pista/efeitos";

interface Props {
  /** O último acerto; `tempo` muda a cada nota e reinicia a animação. */
  julgamento: { julgamento: Julgamento; tempo: number } | null;
  className?: string;
}

/**
 * O "PERFEITO / ÓTIMO / BOM" do último acerto, no letreiro do jogo. O tamanho vem de quem o coloca.
 * Animação em CSS (`aviso-de-acerto`), reiniciada pela `key`: em trechos rápidos são mais de dez por segundo,
 * e montar uma animação do framer-motion a cada nota pesa no meio da música.
 */
export function AvisoDeAcerto({ julgamento, className }: Props) {
  if (!julgamento) return null;
  const { texto, cor } = estiloDoJulgamento(julgamento.julgamento);
  return (
    <div aria-live="off" className={cn("pointer-events-none", className)}>
      <p
        key={julgamento.tempo}
        className="aviso-de-acerto desgastado origin-left font-letreiro leading-none whitespace-nowrap"
        style={{ color: cor, animationDuration: `${DURACAO_DO_JULGAMENTO * 1.6}s` }}
      >
        {texto}
      </p>
    </div>
  );
}
