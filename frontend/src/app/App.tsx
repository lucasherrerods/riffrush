import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { contasLigadas, sessaoDaConta, useConta } from "@/modules/conta";
import { FundoDoMania, IDENTIDADE_DO_MANIA, TelaDoMania, carregarTelaDoMania } from "@/modules/mania";
import { AlavancaDeModo, PARTE_DA_TELA_DO_MODO } from "@/modules/menu";
import { usePrimeiraMusicaPronta } from "@/modules/player";
import { chatGlobal, presenca } from "@/modules/presenca";
import { DecoracaoDoEvento, eventoAtual } from "@/shared/eventos";
import { FundoDoRock, IDENTIDADE_DO_ROCK } from "@/modules/rock";
import { definirTema } from "@/shared/styles/tema";
import { TEMAS } from "@/shared/styles/tokens";
import { CortinaDeAbertura } from "@/shared/ui/CortinaDeAbertura";
import { TelaCarregando } from "@/shared/ui/TelaCarregando";
import { avisar } from "@/shared/ui/avisos";
import { CapaDaVolvelle, Volvelle, type FotoDaTela, type LadoDaVolvelle } from "@/shared/ui/volvelle/Volvelle";
import { LIMITE_DA_ABERTURA_MS, aberturaPronta } from "./abertura";
import { AppDoRock } from "./AppDoRock";
import { trocarModo, useModo, type Modo } from "./modo";
import { useTrocaDeModo } from "./useTrocaDeModo";

const IDENTIDADES = { rock: IDENTIDADE_DO_ROCK, mania: IDENTIDADE_DO_MANIA };

/** Em época de evento (Natal...), o tema dele substitui o de cada modo. */
const temaDoModo = (modo: Modo) => eventoAtual?.temas[modo] ?? TEMAS[IDENTIDADES[modo].tema];

/** O cenário de cada modo no disco da troca: o mesmo fundo da tela inicial, com o tema dele. */
const CENAS: Record<Modo, LadoDaVolvelle> = {
  rock: { cena: <FundoDoRock />, tema: temaDoModo("rock") },
  mania: { cena: <FundoDoMania />, tema: temaDoModo("mania") },
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
    definirTema(temaDoModo(modo));
    // O cursor e outros detalhes de CSS de cada modo leem este atributo.
    document.documentElement.dataset.modo = modo;
    if (eventoAtual) document.documentElement.dataset.evento = eventoAtual.id;
    document.title = identidade.nome;
  }, [identidade, modo]);
  // Os amigos veem em que modo a pessoa está, e cada mensagem do chat leva a etiqueta dele.
  useEffect(() => {
    presenca.definirModo(modo);
    chatGlobal.definirModo(modo);
  }, [modo]);
  // Termina o login que voltou do Google ou retoma a sessão guardada, em qualquer modo que o app abrir.
  const [contaIniciada, setContaIniciada] = useState(false);
  useEffect(() => {
    if (!contasLigadas) return;
    sessaoDaConta
      .iniciar()
      .catch((erro) => avisar.error(erro instanceof Error ? erro.message : String(erro)))
      .finally(() => setContaIniciada(true));
  }, []);
  // A cortina da abertura espera o perfil e a primeira música (que traz a capa do fundo), até o tempo limite.
  const contaCarregando = useConta().carregando;
  const trilhaPronta = usePrimeiraMusicaPronta();
  const [esgotou, setEsgotou] = useState(false);
  useEffect(() => {
    const limite = setTimeout(() => setEsgotou(true), LIMITE_DA_ABERTURA_MS);
    return () => clearTimeout(limite);
  }, []);
  const [aberto, setAberto] = useState(false);
  const pronto = aberto || aberturaPronta({ contasLigadas, contaIniciada, contaCarregando, trilhaPronta, esgotou });
  // Depois de aberta, a cortina não volta: um login no meio do uso não cobre a tela.
  useEffect(() => {
    if (pronto) setAberto(true);
  }, [pronto]);
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
      {/* Os enfeites do evento só nos menus da tela inicial, para não atrapalhar a leitura da pista. */}
      {naTelaInicial && !giro && <DecoracaoDoEvento evento={eventoAtual} />}
      <CortinaDeAbertura pronto={pronto} />
    </>
  );
}
