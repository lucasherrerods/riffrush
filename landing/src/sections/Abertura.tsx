import { motion } from "framer-motion";
import { temaAtivo } from "@jogo/src/shared/styles/tokens";
import { PistaDemo } from "@/demo/PistaDemo";
import { Chamadas } from "./comuns";

const HOLOFOTES = [
  { esquerda: "12%", cor: temaAtivo.cores.primaria, de: "-24deg", ate: "10deg", duracao: "7s" },
  { esquerda: "50%", cor: temaAtivo.cores.texto, de: "-12deg", ate: "12deg", duracao: "9s" },
  { esquerda: "88%", cor: temaAtivo.cores.destaque, de: "-10deg", ate: "24deg", duracao: "8s" },
];

const NUMEROS = [
  { valor: "4", rotulo: "jogadores por sala" },
  { valor: "LAN", rotulo: "e online" },
  { valor: "0", rotulo: "reais. É grátis" },
];

export function Abertura() {
  return (
    <section className="relative isolate overflow-hidden pt-28 pb-20 md:pt-36">
      {/* Iluminação de palco só no fundo (design.md, Palco). */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-25">
        {HOLOFOTES.map((h) => (
          <div
            key={h.esquerda}
            className="holofote"
            style={{ left: h.esquerda, background: `linear-gradient(${h.cor}, transparent 85%)`, animationDuration: h.duracao, ["--de" as string]: h.de, ["--ate" as string]: h.ate }}
          />
        ))}
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 md:px-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 inline-block border border-borda bg-superficie px-4 py-1 font-titulo text-lg tracking-widest text-texto-suave"
          >
            Grátis · Código aberto · PC e navegador
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 40, skewX: -6 }}
            animate={{ opacity: 1, y: 0, skewX: -6 }}
            transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            className="titulo-do-jogo text-[clamp(4.5rem,13vw,10rem)] leading-[0.85]"
          >
            Riff
            <br />
            <span className="text-primaria">Rush</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mt-8 max-w-[56ch] text-lg leading-relaxed text-texto-suave"
          >
            O jogo de ritmo para tocar com a galera. Pegue o teclado, o controle ou o celular, escolha a música e suba no palco com até 4 amigos, na mesma rede ou pela internet.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.6 }} className="mt-10">
            <Chamadas />
          </motion.div>
          <dl className="mt-12 grid max-w-md grid-cols-3 gap-6">
            {NUMEROS.map((n) => (
              <div key={n.rotulo}>
                <dt className="sr-only">{n.rotulo}</dt>
                <dd className="font-titulo text-5xl leading-none text-texto">{n.valor}</dd>
                <dd className="mt-1 text-sm text-texto-suave">{n.rotulo}</dd>
              </div>
            ))}
          </dl>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.8 }}
          className="placa h-[560px] p-6 lg:col-span-5"
        >
          <PistaDemo />
        </motion.div>
      </div>
    </section>
  );
}
