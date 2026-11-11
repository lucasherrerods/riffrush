import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Heart, Star } from "lucide-react";
import { SeloDaNota } from "@/shared/ui/SeloDaNota";
import { useTelaEstreita } from "@/shared/hooks/useTelaEstreita";
import { cn } from "@/shared/lib/utils";
import { ALTURA_DA_DIFICULDADE, ALTURA_DA_MUSICA, ESPACO, centroDoGrupoNaTela, limitar, limitesDoDeslocamento, passoDaInercia, posicoesNoCarrossel, recuoNaCurva } from "./geometriaDoCarrossel";

/** Uma música (Rock) ou um conjunto de mapas (Mania) na roda. */
export interface ItemDoCarrossel {
  id: string;
  titulo: string;
  artista: string;
  /** A capa já montada pelo modo. */
  capa: ReactNode;
  favorita?: boolean;
  /** Estrelas da melhor partida, de 0 a 5; sem partida, nada aparece. */
  estrelas?: number;
}

/** Uma dificuldade aberta embaixo do item selecionado, com a melhor partida da pessoa nela. */
export interface DificuldadeDoCarrossel {
  id: string;
  rotulo: ReactNode;
  /** Classe de fundo da faixa lateral (um token, ex.: `bg-sucesso`). */
  cor: string;
  fullCombo?: boolean;
  precisao?: number;
  pontos?: number;
}

interface Props {
  itens: ItemDoCarrossel[];
  indice: number;
  dificuldade: string;
  /** As dificuldades do item selecionado. */
  dificuldades: DificuldadeDoCarrossel[];
  aoEscolherItem: (indice: number) => void;
  aoEscolherDificuldade: (id: string) => void;
  aoJogar: () => void;
  /** Botão de opções no canto do item selecionado (ex.: apagar o importado). */
  menuDaSelecionada?: ReactNode;
  rotulo?: string;
  className?: string;
}

/** A selecionada sai um pouco da roda, para a esquerda. */
const AVANCO_DA_SELECIONADA = 24;
/** Além disso, a música está fora da tela e não precisa ser desenhada. */
const ALCANCE = 1200;
const MOLA = { type: "spring", stiffness: 260, damping: 32 } as const;

const ESCALA_NO_CELULAR = 0.7;
const AFASTAMENTO_NO_CELULAR = 1.12;
/** Quantos px o dedo anda antes de o toque deixar de ser um clique. */
const LIMITE_DO_TOQUE = 8;
/** Toque mais longo que isso (ms) é segurar, não clicar. */
const TEMPO_DO_TOQUE = 250;
const formatar = (n: number) => n.toLocaleString("pt-BR");

/** Lista em roda, como no osu!lazer: a selecionada fica no meio, com as dificuldades abertas embaixo. */
export function Carrossel({ itens, indice, dificuldade, dificuldades, aoEscolherItem, aoEscolherDificuldade, aoJogar, menuDaSelecionada, rotulo = "Músicas", className }: Props) {
  // Arraste em andamento (dedo ou mouse): a última altura, quando foi e a velocidade em px/ms.
  const toque = useRef<{ y: number; momento: number; velocidade: number } | null>(null);
  const inercia = useRef(0);
  // O toque que arrastou não é clique: sem isso, soltar o dedo escolhe a música onde ele começou.
  const inicioDoToque = useRef(0);
  const arrastou = useRef(false);
  const momentoDoToque = useRef(0);
  const posicoes = posicoesNoCarrossel(itens.length, indice, dificuldades.length);
  // No celular a roda inteira encolhe, para caberem mais músicas e dar para ver que a lista continua.
  const estreita = useTelaEstreita();
  const escala = estreita ? ESCALA_NO_CELULAR : 1;
  // No toque as músicas ficam um pouco mais afastadas, sem crescer, para o dedo não acertar a vizinha.
  const passo = escala * (estreita ? AFASTAMENTO_NO_CELULAR : 1);
  // Com muitas dificuldades o grupo aberto passa da tela: aí ele mostra do topo e segue a escolhida.
  const lista = useRef<HTMLUListElement>(null);
  const [alturaVisivel, setAlturaVisivel] = useState(0);
  useEffect(() => {
    const el = lista.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(() => setAlturaVisivel(el.clientHeight));
    observador.observe(el);
    setAlturaVisivel(el.clientHeight);
    return () => observador.disconnect();
  }, []);
  const centro = centroDoGrupoNaTela(dificuldades.length, dificuldades.findIndex((d) => d.id === dificuldade), alturaVisivel / passo);

  // Arrastar e girar a roda passeiam pela lista sem trocar a música, como no osu!lazer.
  // Escolher outra música ou dificuldade traz a lista de volta para ela.
  const [deslocamento, setDeslocamento] = useState(0);
  const limites = limitesDoDeslocamento(posicoes, centro, dificuldades.length);
  const limitesAtuais = useRef(limites);
  limitesAtuais.current = limites;
  const pararInercia = () => cancelAnimationFrame(inercia.current);
  useEffect(() => {
    pararInercia();
    setDeslocamento(0);
  }, [indice, dificuldade]);
  useEffect(() => pararInercia, []);
  const andar = (px: number) => setDeslocamento((d) => limitar(d + px, limitesAtuais.current));
  const soltar = (velocidade: number) => {
    pararInercia();
    let anterior = performance.now();
    const quadro = (agora: number) => {
      const { andou, velocidade: resto } = passoDaInercia(velocidade, agora - anterior);
      anterior = agora;
      velocidade = resto;
      andar(andou);
      if (velocidade) inercia.current = requestAnimationFrame(quadro);
    };
    if (velocidade) inercia.current = requestAnimationFrame(quadro);
  };
  const fimDoArraste = () => {
    if (!toque.current) return;
    // Parado no fim do arraste, não sai deslizando.
    const parado = Date.now() - toque.current.momento > 80;
    soltar(parado ? 0 : toque.current.velocidade);
    toque.current = null;
  };

  return (
    <ul
      ref={lista}
      aria-label={rotulo}
      onWheel={(evento) => {
        pararInercia();
        andar(evento.deltaY / passo);
      }}
      onPointerDown={(evento) => {
        pararInercia();
        toque.current = { y: evento.clientY, momento: Date.now(), velocidade: 0 };
        inicioDoToque.current = evento.clientY;
        arrastou.current = false;
        momentoDoToque.current = Date.now();
      }}
      onPointerMove={(evento) => {
        if (!toque.current) return;
        const y = evento.clientY;
        if (Math.abs(y - inicioDoToque.current) > LIMITE_DO_TOQUE) arrastou.current = true;
        const agora = Date.now();
        const px = (toque.current.y - y) / passo;
        const ms = Math.max(agora - toque.current.momento, 1);
        // Média com a velocidade anterior, para um tremido no fim do gesto não decidir a inércia.
        const velocidade = toque.current.velocidade * 0.2 + (px / ms) * 0.8;
        toque.current = { y, momento: agora, velocidade };
        andar(px);
      }}
      onPointerUp={(evento) => {
        fimDoArraste();
        // Segurar o dedo é o começo de um arraste, não um clique (no mouse, clique demorado continua clique).
        if (evento.pointerType !== "mouse" && Date.now() - momentoDoToque.current > TEMPO_DO_TOQUE) arrastou.current = true;
      }}
      onPointerLeave={fimDoArraste}
      onPointerCancel={fimDoArraste}
      onClickCapture={(evento) => {
        if (!arrastou.current) return;
        arrastou.current = false;
        evento.preventDefault();
        evento.stopPropagation();
      }}
      className={cn("relative col-span-7 min-h-0 min-w-0 touch-none overflow-hidden select-none max-md:col-span-1 max-md:min-h-40", className)}
    >
      {itens.map((m, i) => {
        const posicao = posicoes[i];
        if (Math.abs(posicao - deslocamento) > ALCANCE) return null;
        const selecionada = i === indice;
        const x = selecionada ? -AVANCO_DA_SELECIONADA : recuoNaCurva(posicao + ALTURA_DA_MUSICA / 2 - centro - deslocamento);
        return (
          <motion.li
            key={m.id}
            data-indice={i}
            initial={false}
            animate={{ y: (posicao - centro - deslocamento) * passo, x: x * escala }}
            transition={MOLA}
            className="absolute top-1/2 right-0 left-8 max-md:left-4"
          >
            <div className="relative">
            <button
              aria-current={selecionada}
              onClick={() => (selecionada ? aoJogar() : aoEscolherItem(i))}
              style={{ height: ALTURA_DA_MUSICA * escala }}
              className={cn(
                "chapa flex w-full items-center gap-4 px-4 text-left transition-colors max-md:gap-2 max-md:px-2",
                selecionada ? "border-destaque bg-destaque/15" : "border-transparent bg-superficie hover:bg-superficie-hover",
                selecionada && menuDaSelecionada && "pr-16",
              )}
            >
              <span className="size-14 shrink-0 overflow-hidden rounded-sm max-md:size-9">{m.capa}</span>
              <span className="min-w-0 flex-1">
                <span className={cn("flex items-center gap-2 font-titulo text-2xl leading-[1.1] tracking-wide max-md:text-lg", selecionada && "text-destaque")}>
                  {m.favorita && <Heart className="size-4 shrink-0 fill-primaria text-primaria" aria-label="Favorita" />}
                  <span className="truncate">{m.titulo}</span>
                </span>
                <span className="block truncate text-base text-texto-suave max-md:text-xs">{m.artista}</span>
              </span>
              {m.estrelas !== undefined && (
                <span className="flex gap-1" aria-label={`${m.estrelas} estrelas`}>
                  {Array.from({ length: 5 }, (_, k) => (
                    <Star key={k} className={cn("size-3", k < m.estrelas! ? "fill-ouro text-ouro" : "text-borda")} />
                  ))}
                </span>
              )}
            </button>
            {selecionada && menuDaSelecionada && <div className="absolute top-1/2 right-3 -translate-y-1/2">{menuDaSelecionada}</div>}
            </div>

            {selecionada && (
              <div role="radiogroup" aria-label="Dificuldade" style={{ marginTop: ESPACO * escala, gap: ESPACO * escala }} className="flex flex-col pl-12 max-md:pl-8">
                {dificuldades.map((d) => {
                  const escolhida = d.id === dificuldade;
                  return (
                    <motion.button
                      key={d.id}
                      role="radio"
                      aria-checked={escolhida}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => (escolhida ? aoJogar() : aoEscolherDificuldade(d.id))}
                      style={{ height: ALTURA_DA_DIFICULDADE * escala }}
                      className={cn(
                        "chapa flex items-center gap-4 py-2 pr-4 pl-2 text-left transition-colors max-md:gap-2 max-md:py-1 max-md:pr-2",
                        escolhida ? "border-destaque bg-destaque/15" : "border-transparent bg-superficie hover:bg-superficie-hover",
                      )}
                    >
                      <span className={cn("w-1 self-stretch rounded-sm", d.cor)} />
                      <span className={cn("flex-1 font-titulo text-xl tracking-wide uppercase max-md:text-base", escolhida && "text-destaque")}>{d.rotulo}</span>
                      {d.fullCombo && <span className="font-titulo text-xl text-destaque">FC</span>}
                      {d.precisao !== undefined && <SeloDaNota precisao={d.precisao} />}
                      <span className="font-mono text-base text-texto-suave max-md:text-xs">{d.pontos !== undefined ? formatar(d.pontos) : "—"}</span>
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
