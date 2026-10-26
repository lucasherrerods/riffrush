import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import bruno from "@/assets/team/bruno.webp";
import felipe from "@/assets/team/felipe.webp";
import lucas from "@/assets/team/lucas.webp";
import vitor from "@/assets/team/vitor.webp";
import { colunaDaGrade, medidaEntre, poligonoDoCorte, posicaoNaGrade, type Medida } from "@/effects";
import { Surge, Titulo } from "./comuns";

const INTEGRANTES = [
  { nome: "Lucas", foto: lucas },
  { nome: "Vitor", foto: vitor },
  { nome: "Bruno", foto: bruno },
  { nome: "Felipe", foto: felipe },
];

/** O card que abre ocupando o palco; os outros saem de trás dele. */
const DESTAQUE = 1;

/** Espaço entre os cards, em px. */
const GAP = 16;
const COLUNA = colunaDaGrade(INTEGRANTES.length, GAP);
const POSICOES = INTEGRANTES.map((_, i) => posicaoNaGrade(i, INTEGRANTES.length, GAP));
const TELA_CHEIA: Medida = { porcento: 100, px: 0 };
const INICIO: Medida = { porcento: 0, px: 0 };

/** Fases do scroll: o card em destaque encolhe, os outros saem de trás dele e por fim os nomes aparecem. */
const ENCOLHE: [number, number] = [0.05, 0.5];
const ABRE: [number, number] = [0.3, 0.7];
const NOMES: [number, number] = [0.65, 0.9];

function Foto({ nome, foto }: { nome: string; foto: string }) {
  return <img src={foto} alt={`Retrato de ${nome}`} loading="lazy" className="h-full w-full object-cover" />;
}

function Nome({ nome, progresso, indice }: { nome: string; progresso: MotionValue<number>; indice: number }) {
  const atraso = indice * 0.05;
  const opacity = useTransform(progresso, [NOMES[0] + atraso, NOMES[1] + atraso], [0, 1]);
  const y = useTransform(progresso, [NOMES[0] + atraso, NOMES[1] + atraso], [24, 0]);
  return (
    <motion.figcaption style={{ opacity, y }} className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-fundo/90 to-transparent px-6 pt-16 pb-5">
      <span className="font-titulo text-4xl leading-none lg:text-5xl">{nome}</span>
    </motion.figcaption>
  );
}

/** O card em destaque: começa ocupando o palco inteiro e encolhe até a coluna dele. */
function CardEmDestaque({ progresso }: { progresso: MotionValue<number> }) {
  const { nome, foto } = INTEGRANTES[DESTAQUE];
  const t = useTransform(progresso, ENCOLHE, [0, 1]);
  const width = useTransform(t, (v) => medidaEntre(TELA_CHEIA, COLUNA, v));
  const left = useTransform(t, (v) => medidaEntre(INICIO, POSICOES[DESTAQUE], v));
  const clipPath = useTransform(t, (v) => poligonoDoCorte(v * 16));
  const zoom = useTransform(t, [0, 1], [1.15, 1]);
  // Começa um pouco mais baixa que a coluna e cresce até ela enquanto estreita.
  const height = useTransform(t, [0, 1], ["82%", "100%"]);
  const top = useTransform(t, [0, 1], ["9%", "0%"]);
  return (
    <motion.figure style={{ width, left, height, top, clipPath }} className="absolute z-10 overflow-hidden bg-superficie">
      <motion.div style={{ scale: zoom }} className="h-full w-full">
        <Foto nome={nome} foto={foto} />
      </motion.div>
      <Nome nome={nome} progresso={progresso} indice={DESTAQUE} />
    </motion.figure>
  );
}

/** Os outros cards: escondidos atrás do destaque, deslizam até a coluna deles. */
function CardQueSai({ indice, progresso }: { indice: number; progresso: MotionValue<number> }) {
  const { nome, foto } = INTEGRANTES[indice];
  // Distância até o destaque, em larguras do próprio card.
  const x = useTransform(progresso, ABRE, [`${(DESTAQUE - indice) * 100}%`, "0%"]);
  const opacity = useTransform(progresso, [ABRE[0], ABRE[0] + 0.1], [0, 1]);
  const scale = useTransform(progresso, ABRE, [0.85, 1]);
  return (
    <motion.figure
      style={{ x, opacity, scale, left: medidaEntre(POSICOES[indice], POSICOES[indice], 0), width: medidaEntre(COLUNA, COLUNA, 0), clipPath: poligonoDoCorte(16) }}
      className="absolute inset-y-0 overflow-hidden bg-superficie"
    >
      <Foto nome={nome} foto={foto} />
      <Nome nome={nome} progresso={progresso} indice={indice} />
    </motion.figure>
  );
}

/** Lista simples para celular e para quem prefere menos movimento. */
function ListaSimples() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
      {INTEGRANTES.map((integrante) => (
        <Surge key={integrante.nome}>
          <figure className="chapa relative aspect-[4/5] overflow-hidden">
            <Foto {...integrante} />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-fundo/90 to-transparent px-4 pt-16 pb-4 font-titulo text-3xl leading-none sm:px-6 sm:pb-5 sm:text-5xl">
              {integrante.nome}
            </figcaption>
          </figure>
        </Surge>
      ))}
    </div>
  );
}

export function Equipe() {
  const ref = useRef<HTMLElement>(null);
  const parado = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const progresso = useSpring(scrollYProgress, { stiffness: 160, damping: 32, restDelta: 0.0005 });
  const cabecalho = useTransform(progresso, [0, 0.15], [0, 1]);

  const titulo = (
    <div className="flex flex-wrap items-end justify-between gap-x-6">
      <Titulo>A equipe por trás</Titulo>
      <p className="mb-8 max-w-[36ch] md:mb-12 text-lg leading-relaxed text-texto-suave">O time que faz o Riff Rush, do código ao palco.</p>
    </div>
  );

  if (parado) {
    return (
      <section id="equipe" className="scroll-mt-20 border-t border-borda py-32">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          {titulo}
          <ListaSimples />
        </div>
      </section>
    );
  }

  return (
    <section id="equipe" ref={ref} className="border-t border-borda">
      <div className="mx-auto max-w-6xl px-4 py-20 md:hidden">
        {titulo}
        <ListaSimples />
      </div>

      <div className="hidden h-[320svh] md:block">
        <div className="sticky top-0 flex h-svh flex-col">
          <motion.div style={{ opacity: cabecalho }} className="mx-auto w-full max-w-[90rem] px-6 pt-24">
            {titulo}
          </motion.div>
          <div className="relative mx-auto mb-12 w-full max-w-[90rem] flex-1 px-6">
            <div className="relative h-full">
              {INTEGRANTES.map((integrante, indice) =>
                indice === DESTAQUE ? null : <CardQueSai key={integrante.nome} indice={indice} progresso={progresso} />,
              )}
              <CardEmDestaque progresso={progresso} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
