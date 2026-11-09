import { AnimatePresence, motion } from "framer-motion";

/** A capa do que está selecionado, borrada, pinta o fundo da tela; ao trocar, a nova aparece por cima da antiga. */
export function FundoDaSelecao({ chave, children }: { chave?: string; children?: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {chave && (
        <motion.div
          key={chave}
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
