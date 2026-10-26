import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { CorteNoScroll } from "@/effects";
import { LINKS } from "@/links";
import { Rodape } from "./Rodape";

/** O convite final: um palco vermelho que abre com o scroll, e o próprio título é o botão. */
export function Final() {
  return (
    <>
      <section className="px-4 py-20 md:px-6 md:py-32">
        <CorteNoScroll className="gasto mx-auto max-w-6xl bg-primaria" de={160} ate={24}>
          <div className="flex flex-col gap-10 px-6 py-12 md:gap-12 md:px-12 md:py-20">
            <p className="max-w-[32ch] text-lg text-texto">A guitarra está afinada e a plateia já chegou. Só falta você.</p>

            <motion.a href={LINKS.jogarNoNavegador} initial="parado" whileHover="mirando" className="group flex flex-col items-start gap-6 text-fundo sm:flex-row sm:items-end sm:justify-between">
              <h2 className="titulo-do-jogo font-letreiro text-[clamp(3rem,13vw,9rem)] leading-[0.85]" style={{ color: "var(--cor-fundo)", transform: "skewX(-6deg)" }}>
                Sobe no
                <br />
                palco
              </h2>
              <motion.span
                variants={{ parado: { x: 0, rotate: 0 }, mirando: { x: 12, rotate: -45 } }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="corte grid size-14 sm:mb-2 sm:size-16 shrink-0 place-items-center bg-fundo text-texto md:size-24"
              >
                <ArrowRight className="size-8 md:size-10" aria-hidden />
              </motion.span>
              <span className="sr-only">Jogar no navegador</span>
            </motion.a>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-fundo/30 pt-6 text-fundo">
              <span className="font-titulo text-xl md:text-2xl">Grátis · Navegador e PC</span>
              <a href={LINKS.baixar} className="inline-flex items-center gap-2 font-titulo text-xl md:text-2xl underline-offset-4 hover:underline">
                Baixar para PC
                <ArrowUpRight className="size-5" aria-hidden />
              </a>
            </div>
          </div>
        </CorteNoScroll>
      </section>

      <Rodape />
    </>
  );
}
