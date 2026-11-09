import { useEffect, useRef, useState } from "react";
import { URL_DO_RELAY } from "@/modules/multiplayer";
import { ATRASO_AO_VIVO, assistirTransmissao, inicioParaAssistir, precisaSincronizar } from "./espectador";
import type { PartidaTransmitida } from "./protocolo";

export type FaseAoVivo = "conectando" | "semPartida" | "semConteudo" | "esperando" | "assistindo" | "pausado" | "fim";

/** A partida montada para assistir agora. */
export interface AssistindoAoVivo<C, A> {
  partida: PartidaTransmitida;
  /** As entradas recebidas, na mesma lista que a partida lê a cada quadro: as novas valem sem remontar nada. */
  acumulado: A;
  /** O que quem assiste precisa ter (a música, o mapa), achado na biblioteca. */
  conteudo: C;
  /** performance.now em que a música começa para quem assiste. */
  inicio: number;
  /** Muda a cada sincronização: a partida de quem assiste recomeça no ponto certo. */
  chave: number;
}

interface Opcoes<C, A> {
  contaId: string;
  /** Acha na biblioteca o que a partida precisa; sem ele, a fase fica em `semConteudo`. */
  achar: (partida: PartidaTransmitida) => C | null;
  /** Muda quando a biblioteca muda: o que faltava pode ter chegado. */
  biblioteca: unknown;
  /** A lista vazia das entradas, montada no início de cada partida. */
  montar: (partida: PartidaTransmitida) => A;
  /** Junta um lote na lista. */
  acumular: (acumulado: A, lote: [number, number][], ate: number) => void;
  urlDoRelay?: string;
  criarSocket?: Parameters<typeof assistirTransmissao>[3];
}

/** A partida de outra pessoa ao vivo, `ATRASO_AO_VIVO` segundos atrás. O mesmo para o Rock e o Mania; cada um monta a própria tela. */
export function useAoVivo<C, A>({ contaId, achar, biblioteca, montar, acumular, urlDoRelay = URL_DO_RELAY, criarSocket }: Opcoes<C, A>) {
  const [fase, setFase] = useState<FaseAoVivo>("conectando");
  const [assistindo, setAssistindo] = useState<AssistindoAoVivo<C, A> | null>(null);
  const [partida, setPartida] = useState<PartidaTransmitida | null>(null);
  // Lidos pelo socket, que vive o tempo todo da tela.
  const conteudo = useRef<C | null>(null);
  const precisaRecomecar = useRef(true);
  const chave = useRef(0);
  const funcoes = useRef({ achar, montar, acumular });
  funcoes.current = { achar, montar, acumular };

  useEffect(() => {
    let atual: { partida: PartidaTransmitida; acumulado: A } | null = null;
    let inicioAtual = 0;
    let fimAgendado: ReturnType<typeof setTimeout> | undefined;

    const comecar = (ate: number) => {
      if (!atual || conteudo.current === null) return;
      precisaRecomecar.current = false;
      inicioAtual = inicioParaAssistir(performance.now(), ate);
      setAssistindo({ ...atual, conteudo: conteudo.current, inicio: inicioAtual, chave: ++chave.current });
      setFase("assistindo");
    };

    const fechar = assistirTransmissao(
      urlDoRelay,
      contaId,
      (mensagem) => {
        if (mensagem.tipo === "semPartida") return setFase("semPartida");
        if (mensagem.tipo === "inicio") {
          clearTimeout(fimAgendado);
          // As entradas chegam mesmo sem o conteúdo, para quem baixa no meio entrar já sincronizado.
          atual = { partida: mensagem.partida, acumulado: funcoes.current.montar(mensagem.partida) };
          setPartida(mensagem.partida);
          conteudo.current = funcoes.current.achar(mensagem.partida);
          precisaRecomecar.current = true;
          return setFase(conteudo.current !== null ? "esperando" : "semConteudo");
        }
        if (!atual) return;
        if (mensagem.tipo === "lote") {
          funcoes.current.acumular(atual.acumulado, mensagem.entradas, mensagem.ate);
          if (conteudo.current === null) return;
          if (precisaRecomecar.current || precisaSincronizar(performance.now(), inicioAtual, mensagem.ate)) comecar(mensagem.ate);
        } else if (mensagem.tipo === "pausa") {
          if (!mensagem.pausado || conteudo.current === null) return;
          precisaRecomecar.current = true;
          setFase("pausado");
        } else if (mensagem.tipo === "fim") {
          // Quem assiste está atrás: ainda falta ver o finalzinho.
          fimAgendado = setTimeout(() => setFase("fim"), (ATRASO_AO_VIVO + 0.5) * 1000);
        }
      },
      criarSocket,
    );
    return () => {
      clearTimeout(fimAgendado);
      fechar();
    };
  }, [contaId, urlDoRelay, criarSocket]);

  // O que faltava entrou na biblioteca: a partida começa no próximo lote, já no ponto certo.
  useEffect(() => {
    if (fase !== "semConteudo" || !partida) return;
    const achado = achar(partida);
    if (achado === null) return;
    conteudo.current = achado;
    precisaRecomecar.current = true;
    setFase("esperando");
  }, [biblioteca, fase, partida]); // eslint-disable-line react-hooks/exhaustive-deps

  return { fase, partida, assistindo: fase === "assistindo" ? assistindo : null, terminar: () => setFase("fim") };
}
