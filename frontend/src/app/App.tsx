import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { FundoDoMania, IDENTIDADE_DO_MANIA, TelaDoMania, carregarTelaDoMania } from "@/modules/mania";
import { AlavancaDeModo, PARTE_DA_TELA_DO_MODO } from "@/modules/menu";
import { chatGlobal, presenca } from "@/modules/presenca";
import { FundoDoRock, IDENTIDADE_DO_ROCK } from "@/modules/rock";
import { definirTema } from "@/shared/styles/tema";
import { TEMAS } from "@/shared/styles/tokens";
import { TelaCarregando } from "@/shared/ui/TelaCarregando";
import { CapaDaVolvelle, Volvelle, type FotoDaTela, type LadoDaVolvelle } from "@/shared/ui/volvelle/Volvelle";
import { AppDoRock } from "./AppDoRock";
import { trocarModo, useModo, type Modo } from "./modo";
import { useTrocaDeModo } from "./useTrocaDeModo";

const IDENTIDADES = { rock: IDENTIDADE_DO_ROCK, mania: IDENTIDADE_DO_MANIA };

/** O cenário de cada modo no disco da troca: o mesmo fundo da tela inicial, com o tema dele. */
const CENAS: Record<Modo, LadoDaVolvelle> = {
  rock: { cena: <FundoDoRock />, tema: TEMAS[IDENTIDADE_DO_ROCK.tema] },
  mania: { cena: <FundoDoMania />, tema: TEMAS[IDENTIDADE_DO_MANIA.tema] },
};

const preCarregar = (modo: Modo) => {
  if (modo === "mania") void carregarTelaDoMania();
};

/** Fotografa a tela do modo que vai sair: a cópia exata vai na capa do disco e sai girando com ela. */
function fotografarTela(): FotoDaTela | undefined {
  const tela = document.querySelector<HTMLElement>(`[data-parte="${PARTE_DA_TELA_DO_MODO}"]`);
  if (!tela) return undefined;
  const { left, top, width, height } = tela.getBoundingClientRect();
  const foto = tela.cloneNode(true) as HTMLElement;
  foto.removeAttribute("data-parte");
  foto.setAttribute("aria-hidden", "true");
  foto.inert = true;
  // A foto mostra a tela já assentada, mesmo que a alavanca seja girada antes das opções terminarem de chegar.
  for (const elemento of [foto, ...foto.querySelectorAll<HTMLElement>("[style]")]) {
    elemento.style.removeProperty("opacity");
    elemento.style.removeProperty("transform");
  }
  return { elemento: foto, retangulo: { x: left, y: top, largura: width, altura: height } };
}

/** Cada modo é um jogo à parte: o App só escolhe qual montar e veste a interface com o tema dele. */
export function App() {
  const modo = useModo();
  const identidade = IDENTIDADES[modo];
  useEffect(() => {
    definirTema(TEMAS[identidade.tema]);
    // O cursor e outros detalhes de CSS de cada modo leem este atributo.
    document.documentElement.dataset.modo = modo;
    document.title = identidade.nome;
  }, [identidade, modo]);
  // Os amigos veem em que modo a pessoa está, e cada mensagem do chat leva a etiqueta dele.
  useEffect(() => {
    presenca.definirModo(modo);
    chatGlobal.definirModo(modo);
  }, [modo]);
  const semMovimento = useReducedMotion() ?? false;
  const { giro, pedir } = useTrocaDeModo(modo, { trocar: trocarModo, preCarregar, semMovimento });
  // A foto da tela que sai, tirada no clique, antes de o modo trocar.
  const foto = useRef<FotoDaTela>(undefined);
  const pedirTroca = useCallback(
    (para: Modo) => {
      foto.current = fotografarTela();
      pedir(para);
    },
    [pedir],
  );
  const alavanca = <AlavancaDeModo modo={modo} aoTrocar={pedirTroca} />;
  // O disco fica atrás da tela inicial dos dois modos; nas outras telas cada modo tem o próprio fundo.
  const [naTelaInicial, setNaTelaInicial] = useState(true);
  const troca = giro ? { fase: giro.fase, sentido: giro.sentido } : undefined;
  const palco = useMemo(() => ({ troca, aoMudarDeTela: setNaTelaInicial }), [troca?.fase, troca?.sentido]); // eslint-disable-line react-hooks/exhaustive-deps
  const mostrarDisco = naTelaInicial || !!giro;
  const virada = (giro ? (giro.girou ? giro.para : giro.de) : modo) === "mania";
  const saindo = giro ? { lado: CENAS[giro.de], emCima: giro.de === "rock", foto: foto.current } : undefined;
  return (
    <>
      {mostrarDisco && <Volvelle cima={CENAS.rock} baixo={CENAS.mania} virada={virada} girando={!!giro} coberta={giro ? (giro.de === "rock" ? "cima" : "baixo") : undefined} />}
      {modo === "mania" ? (
        <Suspense fallback={<TelaCarregando />}>
          <TelaDoMania alavanca={alavanca} palco={palco} />
        </Suspense>
      ) : (
        <AppDoRock alavanca={alavanca} palco={palco} />
      )}
      {/* Por cima da tela nova: a metade do modo que saiu, com a foto da tela dele, girando para fora. */}
      {mostrarDisco && <CapaDaVolvelle saindo={saindo} virada={virada} />}
    </>
  );
}
