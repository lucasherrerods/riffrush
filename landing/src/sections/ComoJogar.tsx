import { motion } from "framer-motion";
import { Surge, Titulo } from "./comuns";

const PASSOS = [
  { titulo: "Abra o jogo", texto: "No navegador ou na versão de PC, que também abre a sala da LAN." },
  { titulo: "Escolha a música", texto: "A que vem com o jogo ou as suas do Clone Hero e do Encore." },
  { titulo: "Chame a galera", texto: "QR code ou código da sala. Contou até três, é show." },
];

/** A contagem do baterista antes da música: cada número bate no tempo, um depois do outro. */
export function ComoJogar() {
  return (
    <section id="como-jogar" className="scroll-mt-20 border-t border-borda py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Surge>
          <Titulo>Um, dois, três, já</Titulo>
        </Surge>
        <ol className="grid gap-12 overflow-hidden md:grid-cols-3 md:gap-6">
          {PASSOS.map((passo, i) => (
            <li key={passo.titulo}>
              <motion.span
                aria-hidden
                className="titulo-do-jogo block origin-bottom-left font-letreiro text-[7rem] leading-[0.8] md:text-[9rem] text-primaria"
                initial={{ opacity: 0, scale: 1.3, skewX: -6 }}
                whileInView={{ opacity: 1, scale: 1, skewX: -6 }}
                viewport={{ once: true, margin: "-120px" }}
                transition={{ delay: i * 0.45, type: "spring", stiffness: 500, damping: 18 }}
              >
                {i + 1}
              </motion.span>
              <Surge atraso={i * 0.45 + 0.1}>
                <h3 className="mt-6 mb-2 text-3xl leading-none">{passo.titulo}</h3>
                <p className="max-w-[32ch] text-base leading-relaxed text-texto-suave">{passo.texto}</p>
              </Surge>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
