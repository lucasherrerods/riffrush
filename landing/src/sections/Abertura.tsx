import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { TEMA_PADRAO } from "@jogo/src/shared/styles/tokens";
import { PistaDoPalco } from "@/demo/PistaDoPalco";
import { Chamadas } from "./comuns";

const HOLOFOTES = [
  { esquerda: "10%", cor: TEMA_PADRAO.cores.primaria, de: "-24deg", ate: "10deg", duracao: "7s" },
  { esquerda: "90%", cor: TEMA_PADRAO.cores.destaque, de: "-10deg", ate: "24deg", duracao: "8s" },
];

const ENTRADA = [0.2, 0.8, 0.2, 1] as const;

export function Abertura() {
  const ref = useRef<HTMLElement>(null);
  const parado = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  // Ao descer, a câmera mergulha na pista e o título sobe e some.
  const mergulho = useTransform(scrollYProgress, [0, 1], [1, 1.6]);
  const tituloY = useTransform(scrollYProgress, [0, 1], ["0%", "-40%"]);
  const tituloOpacidade = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const luz = useTransform(scrollYProgress, [0, 0.8], [0.22, 0]);

  return (
    <section ref={ref} className="relative isolate flex min-h-svh flex-col items-center overflow-hidden px-4 pt-28 pb-16 text-center md:pt-40">
      <motion.div className="pointer-events-none absolute inset-0 -z-20" style={{ opacity: parado ? 0.22 : luz }}>
        {HOLOFOTES.map((h) => (
          <div
            key={h.esquerda}
            className="holofote"
            style={{ left: h.esquerda, background: `linear-gradient(${h.cor}, transparent 85%)`, animationDuration: h.duracao, ["--de" as string]: h.de, ["--ate" as string]: h.ate }}
          />
        ))}
      </motion.div>

      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[58%] origin-bottom [mask-image:linear-gradient(transparent,black_45%)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.3 }}
        style={parado ? undefined : { scale: mergulho }}
      >
        <PistaDoPalco className="h-full w-full" />
      </motion.div>

      <motion.div style={parado ? undefined : { y: tituloY, opacity: tituloOpacidade }} className="flex w-full flex-col items-center">
        <motion.h1
          initial={{ opacity: 0, y: 40, letterSpacing: "0.2em" }}
          animate={{ opacity: 1, y: 0, letterSpacing: "0.02em" }}
          transition={{ duration: 0.9, ease: ENTRADA }}
          className="titulo-do-jogo text-[clamp(3.5rem,17vw,13rem)] leading-[0.82]"
        >
          Riff <span className="text-primaria">Rush</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="mt-6 max-w-[44ch] text-lg md:mt-8 leading-relaxed text-texto-suave"
        >
          Quatro amigos, uma música e nenhuma desculpa para errar a nota.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }} className="mt-8 w-full md:mt-10 md:w-auto">
          <Chamadas centralizadas />
        </motion.div>
      </motion.div>
    </section>
  );
}
