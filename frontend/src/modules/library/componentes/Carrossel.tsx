import { useRef } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { recordeDe, type Recordes } from "@/modules/results";
import type { Dificuldade, Instrumento, Musica } from "@/modules/songs";
import { cn } from "@/shared/lib/utils";
import { ALTURA_DA_DIFICULDADE, ALTURA_DA_MUSICA, centroDoGrupoAberto, passosDaRoda, posicoesNoCarrossel, recuoNaCurva } from "../carrossel";
import { Capa } from "./Capa";

interface Props {
  musicas: Musica[];
  indice: number;
  dificuldade: Dificuldade;
  instrumento: Instrumento;
  /** As dificuldades que a música selecionada tem. */
  dificuldades: { id: Dificuldade; rotulo: string }[];
  recordes: Recordes;
  aoEscolherMusica: (indice: number) => void;
  aoEscolherDificuldade: (dificuldade: Dificuldade) => void;
  aoJogar: () => void;
  /** Músicas a andar pela roda do mouse (negativo sobe). */
  aoGirar: (passos: number) => void;
}

/** A selecionada sai um pouco da roda, para a esquerda. */
const AVANCO_DA_SELECIONADA = 24;
/** Além disso, a música está fora da tela e não precisa ser desenhada. */
const ALCANCE = 1200;
const MOLA = { type: "spring", stiffness: 260, damping: 32 } as const;

/** Cada dificuldade tem a sua cor na faixa lateral, do verde ao vermelho. */
const COR_DA_DIFICULDADE: Record<Dificuldade, string> = {
  facil: "bg-sucesso",
  medio: "bg-ouro",
  dificil: "bg-destaque",
  expert: "bg-primaria",
};

const formatar = (n: number) => n.toLocaleString("pt-BR");

/** Lista de músicas em roda, como no osu!lazer: a selecionada fica no meio, com as dificuldades abertas embaixo. */
export function Carrossel({ musicas, indice, dificuldade, instrumento, dificuldades, recordes, aoEscolherMusica, aoEscolherDificuldade, aoJogar, aoGirar }: Props) {
  const giro = useRef(0);
  const posicoes = posicoesNoCarrossel(musicas.length, indice, dificuldades.length);
  const centro = centroDoGrupoAberto(dificuldades.length);

  return (
    <ul
      aria-label="Músicas"
      onWheel={(evento) => {
        const { passos, resto } = passosDaRoda(giro.current + evento.deltaY);
        giro.current = resto;
        if (passos) aoGirar(passos);
      }}
      className="relative col-span-7 min-h-0 min-w-0 overflow-hidden max-md:col-span-1 max-md:min-h-80"
    >
      {musicas.map((m, i) => {
        const posicao = posicoes[i];
        if (Math.abs(posicao) > ALCANCE) return null;
        const selecionada = i === indice;
        const recorde = recordeDe(recordes, m.id, dificuldade, instrumento);
        const x = selecionada ? -AVANCO_DA_SELECIONADA : recuoNaCurva(posicao + ALTURA_DA_MUSICA / 2 - centro);
        return (
          <motion.li
            key={m.id}
            data-indice={i}
            initial={false}
            animate={{ y: posicao - centro, x }}
            transition={MOLA}
            className="absolute top-1/2 right-0 left-8"
          >
            <button
              aria-current={selecionada}
              onClick={() => (selecionada ? aoJogar() : aoEscolherMusica(i))}
              style={{ height: ALTURA_DA_MUSICA }}
              className={cn(
                "chapa flex w-full items-center gap-4 px-4 text-left transition-colors",
                selecionada ? "border-destaque bg-destaque/15" : "border-transparent bg-superficie hover:bg-superficie-elevada",
              )}
            >
              <Capa musica={m} decorativa className="size-14 rounded-sm" />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate font-titulo text-2xl leading-[1.1] tracking-wide", selecionada && "text-destaque")}>{m.titulo}</span>
                <span className="block truncate text-base text-texto-suave">{m.artista}</span>
              </span>
              {recorde && (
                <span className="flex gap-1" aria-label={`${recorde.estrelas} estrelas`}>
                  {Array.from({ length: 5 }, (_, k) => (
                    <Star key={k} className={cn("size-3", k < recorde.estrelas ? "fill-ouro text-ouro" : "text-borda")} />
                  ))}
                </span>
              )}
            </button>

            {selecionada && (
              <div role="radiogroup" aria-label="Dificuldade" className="mt-2 flex flex-col gap-2 pl-12">
                {dificuldades.map((d) => {
                  const escolhida = d.id === dificuldade;
                  const recordeDaDificuldade = recordeDe(recordes, m.id, d.id, instrumento);
                  return (
                    <motion.button
                      key={d.id}
                      role="radio"
                      aria-checked={escolhida}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => (escolhida ? aoJogar() : aoEscolherDificuldade(d.id))}
                      style={{ height: ALTURA_DA_DIFICULDADE }}
                      className={cn(
                        "chapa flex items-center gap-4 py-2 pr-4 pl-2 text-left transition-colors",
                        escolhida ? "border-destaque bg-destaque/15" : "border-transparent bg-superficie-elevada hover:border-borda",
                      )}
                    >
                      <span className={cn("w-1 self-stretch rounded-sm", COR_DA_DIFICULDADE[d.id])} />
                      <span className={cn("flex-1 font-titulo text-xl tracking-wide uppercase", escolhida && "text-destaque")}>{d.rotulo}</span>
                      {recordeDaDificuldade?.fullCombo && <span className="font-titulo text-xl text-destaque">FC</span>}
                      <span className="font-mono text-base text-texto-suave">{recordeDaDificuldade ? formatar(recordeDaDificuldade.pontos) : "—"}</span>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </motion.li>
        );
      })}
    </ul>
  );
}
