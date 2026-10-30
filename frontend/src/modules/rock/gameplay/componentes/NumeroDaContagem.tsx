import { motion } from "framer-motion";

/** O número grande do 3, 2, 1: no começo da música e ao voltar da pausa. */
export function NumeroDaContagem({ valor }: { valor: number }) {
  return (
    <motion.p
      role="timer"
      aria-label={`Volta em ${valor}`}
      initial={{ scale: 2, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.5, opacity: 0 }}
      className="pointer-events-none absolute inset-0 flex items-center justify-center text-8xl font-black"
    >
      {valor}
    </motion.p>
  );
}
