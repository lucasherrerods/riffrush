import { motion } from "framer-motion";
import { temaAtivo } from "@jogo/src/shared/styles/tokens";
import { Surge, Titulo } from "./comuns";

const RECURSOS = [
  { titulo: "Até 4 na mesma música", texto: "Na mesma rede ou pela internet." },
  { titulo: "Suas músicas do Clone Hero", texto: ".chart, .mid, .sng e o Encore." },
  { titulo: "Ranking com replay", texto: "Seu recorde, nota por nota." },
  { titulo: "Partidas ao vivo", texto: "Assista quem está tocando agora." },
];

/** Os recursos como o setlist colado no chão do palco: uma faixa por linha. */
export function Recursos() {
  const trastes = temaAtivo.pista.trastes;
  return (
    <section id="recursos" className="scroll-mt-20 py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Surge>
          <Titulo>Setlist</Titulo>
        </Surge>
        <ol className="border-t border-borda">
          {RECURSOS.map((recurso, i) => (
            <motion.li
              key={recurso.titulo}
              initial="fora"
              whileInView="dentro"
              whileHover="tocando"
              viewport={{ once: true, margin: "-60px" }}
              variants={{ fora: { opacity: 0, x: -24 }, dentro: { opacity: 1, x: 0 } }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="relative isolate grid grid-cols-[2.5rem_1fr] items-baseline gap-x-4 md:gap-x-6 gap-y-2 overflow-hidden border-b border-borda py-6 md:grid-cols-[4rem_1fr_1fr]"
            >
              <motion.span
                aria-hidden
                className="absolute inset-0 -z-10 origin-left"
                style={{ background: trastes[i % trastes.length], opacity: 0.14 }}
                variants={{ fora: { scaleX: 0 }, dentro: { scaleX: 0 }, tocando: { scaleX: 1 } }}
                transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              />
              <span className="font-titulo text-2xl" style={{ color: trastes[i % trastes.length] }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <motion.h3 className="text-3xl leading-none sm:text-4xl md:text-5xl" variants={{ tocando: { x: 12 } }}>
                {recurso.titulo}
              </motion.h3>
              <p className="col-start-2 text-base leading-relaxed text-texto-suave md:col-start-3">{recurso.texto}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
