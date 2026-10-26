import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { poligonoDoCorte } from "./corte";

interface Props {
  children: ReactNode;
  className?: string;
  /** Quina cortada quando o bloco ainda está entrando na tela. */
  de?: number;
  /** Quina cortada quando o bloco chega ao centro. */
  ate?: number;
}

/**
 * Bloco que nasce pequeno, com a quina da guitarra bem funda, e abre até ocupar a tela
 * conforme a página desce.
 */
export function CorteNoScroll({ children, className, de = 120, ate = 16 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const parado = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const progresso = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });
  const corte = useTransform(progresso, [0, 1], [de, ate], { clamp: true });
  const clipPath = useTransform(corte, poligonoDoCorte);
  const escala = useTransform(progresso, [0, 1], [0.82, 1], { clamp: true });
  const zoom = useTransform(progresso, [0, 1], [1.25, 1], { clamp: true });

  return (
    <motion.div ref={ref} className={className} style={parado ? { clipPath: poligonoDoCorte(ate) } : { clipPath, scale: escala }}>
      <motion.div className="h-full w-full" style={parado ? undefined : { scale: zoom }}>
        {children}
      </motion.div>
    </motion.div>
  );
}
