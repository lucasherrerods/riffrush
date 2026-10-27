import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import type { Julgamento } from "../partida";
import { DURACAO_DO_JULGAMENTO, estiloDoJulgamento } from "../pista/efeitos";

interface Props {
  /** O último acerto; `tempo` muda a cada nota e reinicia a animação. */
  julgamento: { julgamento: Julgamento; tempo: number } | null;
  className?: string;
}

/** O "PERFEITO / ÓTIMO / BOM" do último acerto, no letreiro do jogo. O tamanho vem de quem o coloca. */
export function AvisoDeAcerto({ julgamento, className }: Props) {
  if (!julgamento) return null;
  const { texto, cor } = estiloDoJulgamento(julgamento.julgamento);
  return (
    <div aria-live="off" className={cn("pointer-events-none", className)}>
      <AnimatePresence mode="popLayout">
        <motion.p
          key={julgamento.tempo}
          initial={{ opacity: 0, scale: 1.5, skewX: -6 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [1.5, 1, 1, 0.95], skewX: -6 }}
          transition={{ duration: DURACAO_DO_JULGAMENTO * 1.6, times: [0, 0.15, 0.7, 1], ease: "easeOut" }}
          className="desgastado origin-left font-letreiro leading-none whitespace-nowrap"
          style={{ color: cor }}
        >
          {texto}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
