import banda from "@jogo/docs/img/personagens.png";
import { CorteNoScroll } from "@/effects";
import { Surge, Titulo } from "./comuns";

export function Banda() {
  return (
    <section id="banda" className="scroll-mt-20 pb-20 md:pb-32">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Surge className="flex flex-wrap items-end justify-between gap-6">
          <Titulo>Monte a sua banda</Titulo>
          <p className="mb-8 max-w-[40ch] md:mb-12 text-lg leading-relaxed text-texto-suave">
            Cada um sobe com o próprio roqueiro. A sequência cresce, a banda vibra. Errou, ela sente.
          </p>
        </Surge>
        <CorteNoScroll className="bg-superficie">
          <img src={banda} alt="Cinco personagens do Riff Rush dançando lado a lado" className="w-full" loading="lazy" />
        </CorteNoScroll>
      </div>
    </section>
  );
}
