import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";

/** Cobre a tela na abertura do app enquanto as partes dela carregam; depois sai num fade. */
export function CortinaDeAbertura({ pronto }: { pronto: boolean }) {
  return (
    <AnimatePresence>
      {!pronto && (
        <motion.div
          role="status"
          aria-label="Abrindo o jogo"
          className="fixed inset-0 z-50 grid place-items-center bg-fundo"
          initial={false}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Loader2 className="size-10 animate-spin text-primaria" aria-hidden />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
