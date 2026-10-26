import banda from "@jogo/docs/img/personagens.png";
import { Surge, Titulo } from "./comuns";

const DETALHES = ["Cabelo, roupa e cores do seu jeito", "Animações de palco que reagem à partida", "A banda inteira tocando junto no multijogador"];

export function Banda() {
  return (
    <section id="banda" className="scroll-mt-20 border-y border-borda bg-superficie py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 md:px-6 lg:grid-cols-12">
        <Surge className="lg:col-span-5">
          <Titulo selo="Personagens 3D">Monte a sua banda</Titulo>
          <p className="mb-8 max-w-[56ch] text-lg leading-relaxed text-texto-suave">
            Cada jogador sobe no palco com o próprio roqueiro. Quando a sequência cresce, a banda vibra; quando você erra, ela sente.
          </p>
          <ul className="space-y-3">
            {DETALHES.map((detalhe) => (
              <li key={detalhe} className="flex items-center gap-3 text-base">
                <span className="size-2 rotate-45 bg-primaria" aria-hidden />
                {detalhe}
              </li>
            ))}
          </ul>
        </Surge>
        <Surge atraso={0.15} className="lg:col-span-7">
          <img src={banda} alt="Cinco personagens do Riff Rush dançando lado a lado" className="w-full" loading="lazy" />
        </Surge>
      </div>
    </section>
  );
}
