import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { temaAtivo } from "@jogo/src/shared/styles/tokens";

const INSTRUMENTOS = [
  { nome: "Teclado", texto: "Nada para comprar. Cada tecla no lugar que a sua mão pedir." },
  { nome: "Controle", texto: "Xbox ou PlayStation. Pluga e toca." },
  { nome: "Celular", texto: "Leu o QR code, virou guitarra. Sem instalar nada." },
];

const TOTAL = INSTRUMENTOS.length;

/** Um instrumento por vez ocupa a tela: entra por baixo, segura e sai por cima. */
function Instrumento({ indice, progresso }: { indice: number; progresso: MotionValue<number> }) {
  const { nome, texto } = INSTRUMENTOS[indice];
  const inicio = indice / TOTAL;
  const fim = (indice + 1) / TOTAL;
  const primeiro = indice === 0;
  const ultimo = indice === TOTAL - 1;
  const entrada = [inicio, inicio + 0.08, fim - 0.08, fim];
  const y = useTransform(progresso, entrada, [primeiro ? "0%" : "100%", "0%", "0%", ultimo ? "0%" : "-100%"]);
  const opacity = useTransform(progresso, entrada, [primeiro ? 1 : 0, 1, 1, ultimo ? 1 : 0]);

  return (
    <motion.div style={{ opacity }} className="absolute inset-0 flex flex-col justify-center">
      <div className="overflow-hidden">
        <motion.p style={{ y }} className="font-titulo text-[clamp(5rem,22vw,20rem)] leading-[0.8] uppercase">
          {nome}
        </motion.p>
      </div>
      <p className="mt-6 max-w-[36ch] text-lg text-texto-suave md:text-xl">{texto}</p>
    </motion.div>
  );
}

/** Os três jeitos de tocar, presos na tela enquanto a página desce. */
export function Manifesto() {
  const ref = useRef<HTMLElement>(null);
  const parado = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const barra = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const contador = useTransform(scrollYProgress, (p) => `0${Math.min(TOTAL, Math.floor(p * TOTAL) + 1)}`);
  const trastes = temaAtivo.pista.trastes;

  if (parado) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-32 md:px-6">
        <h2 className="mb-12 text-3xl text-texto-suave">Escolha o instrumento</h2>
        {INSTRUMENTOS.map((i) => (
          <div key={i.nome} className="mb-12">
            <p className="font-titulo text-8xl leading-none uppercase">{i.nome}</p>
            <p className="mt-4 text-xl text-texto-suave">{i.texto}</p>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section ref={ref} className="relative h-[300svh]">
      <div className="sticky top-0 flex h-svh flex-col overflow-hidden">
        <div className="mx-auto flex w-full max-w-6xl items-end justify-between gap-4 px-4 pt-24 md:px-6 md:pt-28">
          <h2 className="text-2xl text-texto-suave md:text-3xl">Escolha o instrumento</h2>
          <p className="font-titulo text-2xl text-texto-suave tabular-nums md:text-3xl">
            <motion.span className="text-texto">{contador}</motion.span> / 0{TOTAL}
          </p>
        </div>
        <div className="relative mx-auto w-full max-w-6xl flex-1 px-4 md:px-6">
          {INSTRUMENTOS.map((i, indice) => (
            <Instrumento key={i.nome} indice={indice} progresso={scrollYProgress} />
          ))}
        </div>
        {/* O braço da guitarra como barra de progresso: as cinco cores dos trastes. */}
        <motion.div className="mx-auto mb-12 flex h-1 w-[calc(100%-2rem)] max-w-6xl origin-left md:w-[calc(100%-3rem)]" style={{ scaleX: barra }}>
          {trastes.map((cor) => (
            <span key={cor} className="flex-1" style={{ background: cor }} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
