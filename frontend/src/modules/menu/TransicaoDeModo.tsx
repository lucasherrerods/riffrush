import { motion } from "framer-motion";
import { Zap } from "lucide-react";

/** Quando a tela já está toda coberta e o tema pode trocar sem aparecer. */
export const COBERTURA_DA_TRANSICAO_MS = 450;
export const DURACAO_DA_TRANSICAO_MS = 1200;

const LAMINAS = 7;
const ATRASO_POR_LAMINA = 0.02;
const DURACAO = 1;

interface Props {
  nome: string;
  /** As cores do modo de destino: a transição já chega vestida com o tema novo. */
  cores: { fundo: string; primaria: string; texto: string };
}

/** Lâminas de palco fecham a tela, o raio cai com o nome do modo e tudo abre já no tema novo. */
export function TransicaoDeModo({ nome, cores }: Props) {
  return (
    <div data-testid="transicao-de-modo" aria-hidden className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute -inset-x-[15%] inset-y-0 flex">
        {Array.from({ length: LAMINAS }, (_, i) => (
          <motion.div
            key={i}
            className="-mx-px h-full flex-1 -skew-x-12"
            style={{ backgroundColor: i % 2 ? cores.primaria : cores.fundo, originY: i % 2 ? 0 : 1 }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: [0, 1, 1, 0] }}
            transition={{ duration: DURACAO, delay: i * ATRASO_POR_LAMINA, times: [0, 0.3, 0.72, 1], ease: "easeInOut" }}
          />
        ))}
      </div>

      <motion.div
        className="absolute inset-0"
        style={{ backgroundColor: cores.texto }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0, 0.5, 0] }}
        transition={{ duration: 0.4, delay: 0.32 }}
      />

      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="absolute size-64 rounded-full border-8"
          style={{ borderColor: cores.texto }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 5], opacity: [0.9, 0] }}
          transition={{ duration: 0.6, delay: 0.36, ease: "easeOut" }}
        />
        <motion.div
          className="relative flex items-center gap-4 px-8 py-2 -skew-x-12 max-md:gap-2 max-md:px-4"
          style={{ backgroundColor: cores.primaria, color: cores.texto }}
          initial={{ scale: 3, opacity: 0 }}
          animate={{ scale: [3, 1, 1.06, 1, 0.7], opacity: [0, 1, 1, 1, 0], x: [0, -14, 12, -6, 0] }}
          transition={{ duration: 0.8, delay: 0.24, times: [0, 0.2, 0.3, 0.75, 1] }}
        >
          <Zap className="size-16 fill-current max-md:size-10" />
          <span className="font-letreiro text-8xl leading-none uppercase max-md:text-5xl">{nome}</span>
        </motion.div>
      </div>
    </div>
  );
}
