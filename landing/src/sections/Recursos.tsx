import { Gamepad2, Library, Radio, Smartphone, Trophy, Users, Wifi, Zap, type LucideIcon } from "lucide-react";
import { temaAtivo } from "@jogo/src/shared/styles/tokens";
import { Surge, Titulo } from "./comuns";

interface Recurso {
  icone: LucideIcon;
  titulo: string;
  texto: string;
}

const RECURSOS: Recurso[] = [
  { icone: Users, titulo: "Até 4 na mesma música", texto: "Monte a sala, chame os amigos e disputem nota a nota. Quem errar menos leva a coroa." },
  { icone: Smartphone, titulo: "O celular vira guitarra", texto: "Leu o QR code, entrou na sala. Sem instalar nada: o celular joga pelo navegador." },
  { icone: Wifi, titulo: "LAN ou internet", texto: "Na mesma rede, a sala abre no seu PC. Longe, o modo online junta todo mundo." },
  { icone: Library, titulo: "Suas músicas do Clone Hero", texto: "Importe .chart, .mid e .sng, ou busque direto no Encore. Uma biblioteca sem fim." },
  { icone: Gamepad2, titulo: "Teclado ou controle", texto: "Funciona no teclado e em controles de Xbox e PlayStation, com as teclas do seu jeito." },
  { icone: Trophy, titulo: "Ranking e replays", texto: "Seu recorde vai para o ranking com o replay junto. Assista nota por nota como foi feito." },
  { icone: Radio, titulo: "Partidas ao vivo", texto: "Veja quem está online e assista às partidas dos outros enquanto elas acontecem." },
  { icone: Zap, titulo: "Notas abertas e HOPO", texto: "Charts lidos como no Clone Hero, com nota aberta, HOPO e tap no lugar certo." },
];

export function Recursos() {
  const trastes = temaAtivo.pista.trastes;
  return (
    <section id="recursos" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Surge>
          <Titulo selo="Recursos">Tudo o que um palco precisa</Titulo>
        </Surge>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RECURSOS.map((recurso, i) => (
            <Surge key={recurso.titulo} atraso={(i % 4) * 0.08} className="h-full">
              <article className="chapa group h-full p-6 transition-colors hover:bg-superficie-elevada">
                <recurso.icone className="mb-5 size-8 opacity-80" style={{ color: trastes[i % trastes.length] }} aria-hidden />
                <h3 className="mb-2 text-2xl leading-none">{recurso.titulo}</h3>
                <p className="text-base leading-relaxed text-texto-suave">{recurso.texto}</p>
              </article>
            </Surge>
          ))}
        </div>
      </div>
    </section>
  );
}
