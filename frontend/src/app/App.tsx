import { Suspense, useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { FundoDoMania, IDENTIDADE_DO_MANIA, TelaDoMania, carregarTelaDoMania } from "@/modules/mania";
import { AlavancaDeModo, Fundo, LogoDoJogo } from "@/modules/menu";
import { IDENTIDADE_DO_ROCK } from "@/modules/rock";
import { definirTema } from "@/shared/styles/tema";
import { TEMAS } from "@/shared/styles/tokens";
import { TelaCarregando } from "@/shared/ui/TelaCarregando";
import { Volvelle, type LadoDaVolvelle, type PosicaoNaTela } from "@/shared/ui/volvelle/Volvelle";
import { AppDoRock } from "./AppDoRock";
import { MANIA_LIGADO, trocarModo, useModo, type Modo } from "./modo";
import { useTrocaDeModo } from "./useTrocaDeModo";

const IDENTIDADES = { rock: IDENTIDADE_DO_ROCK, mania: IDENTIDADE_DO_MANIA };

/** A cópia do título da tela inicial que vai no disco. */
function TituloDaCena({ modo, subtitulo, fofa }: { modo: string; subtitulo: string; fofa?: boolean }) {
  return (
    <>
      <LogoDoJogo modo={modo} fofa={fofa} />
      <p className="text-center text-xs font-bold tracking-[0.4em] text-texto-suave max-md:tracking-[0.15em]">{subtitulo}</p>
    </>
  );
}

/** O cenário de cada modo no disco da troca: o mesmo fundo da tela inicial, com o tema dele. */
const CENAS: Record<Modo, LadoDaVolvelle> = {
  rock: { cena: <Fundo />, tema: TEMAS[IDENTIDADE_DO_ROCK.tema], titulo: <TituloDaCena modo="Rock" subtitulo="O PALCO É SEU" /> },
  mania: { cena: <FundoDoMania />, tema: TEMAS[IDENTIDADE_DO_MANIA.tema], titulo: <TituloDaCena modo="Mania" subtitulo="SIGA O RITMO" fofa /> },
};

const preCarregar = (modo: Modo) => {
  if (modo === "mania") void carregarTelaDoMania();
};

/** Cada modo é um jogo à parte: o App só escolhe qual montar e veste a interface com o tema dele. */
export function App({ maniaLigado = MANIA_LIGADO }: { maniaLigado?: boolean } = {}) {
  const modo = useModo();
  const identidade = IDENTIDADES[modo];
  useEffect(() => {
    definirTema(TEMAS[identidade.tema]);
    document.title = identidade.nome;
  }, [identidade]);
  const semMovimento = useReducedMotion() ?? false;
  const { giro, pedir } = useTrocaDeModo(modo, { trocar: trocarModo, preCarregar, semMovimento });
  const alavanca = maniaLigado ? <AlavancaDeModo modo={modo} aoTrocar={pedir} /> : undefined;
  // O disco fica atrás da tela inicial dos dois modos; nas outras telas cada modo tem o próprio fundo.
  const [naTelaInicial, setNaTelaInicial] = useState(true);
  const [posicaoDoTitulo, setPosicaoDoTitulo] = useState<PosicaoNaTela>();
  const troca = giro ? { fase: giro.fase, sentido: giro.sentido } : undefined;
  const palco = useMemo(
    () => ({ troca, aoMudarDeTela: setNaTelaInicial, aoMedirTitulo: (r: DOMRect) => setPosicaoDoTitulo({ x: r.left, y: r.top, largura: r.width }) }),
    [troca?.fase, troca?.sentido], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const mostrarDisco = naTelaInicial || !!giro;
  // O disco já gira para o destino no clique, enquanto as opções saem voando.
  const virada = (giro ? giro.para : modo) === "mania";
  return (
    <>
      {mostrarDisco && <Volvelle cima={CENAS.rock} baixo={CENAS.mania} virada={virada} girando={!!giro} posicaoDoTitulo={posicaoDoTitulo} />}
      {modo === "mania" ? (
        <Suspense fallback={<TelaCarregando />}>
          <TelaDoMania alavanca={alavanca} palco={palco} />
        </Suspense>
      ) : (
        <AppDoRock alavanca={alavanca} palco={palco} />
      )}
    </>
  );
}
