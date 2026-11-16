import { useCallback, useEffect, useRef, useState } from "react";
import { lerVolumeGeral, preferenciasDeAudio } from "@/modules/audio";

/** Um teco da música: o bastante para reconhecer, sem virar o player. */
export const DURACAO_DA_PREVIA_MS = 20_000;

export interface FonteDaPrevia {
  url: string;
  /** Onde o trecho começa, em segundos. */
  inicioS: number;
  /** Solta o que a fonte criou (ex.: a URL de um Blob) quando a prévia para. */
  liberar?: () => void;
}

export type EstadoDaPrevia = "parada" | "carregando" | "tocando";

interface Opcoes {
  criarAudio?: () => HTMLAudioElement;
  volume?: () => number;
  /** Avisa quando uma prévia começa ou para, para o modo calar a música de fundo. */
  aoMudar?: (tocando: boolean) => void;
}

const volumeDaMusica = () => lerVolumeGeral() * preferenciasDeAudio.estado().volumeDaMusica;

/** Toca a prévia de uma música da busca por vez, nos dois modos. */
export function usePrevia({ criarAudio = () => new Audio(), volume = volumeDaMusica, aoMudar }: Opcoes = {}) {
  const [atual, setAtual] = useState<{ id: string; estado: Exclude<EstadoDaPrevia, "parada"> } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const pedido = useRef(0);
  const controle = useRef<AbortController | null>(null);
  const liberar = useRef<(() => void) | undefined>(undefined);
  const limite = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tocava = useRef(false);
  const atualRef = useRef(atual);
  atualRef.current = atual;
  const avisar = useRef(aoMudar);
  avisar.current = aoMudar;

  const mudarTocando = (tocando: boolean) => {
    if (tocando === tocava.current) return;
    tocava.current = tocando;
    avisar.current?.(tocando);
  };

  const parar = useCallback(() => {
    pedido.current++;
    controle.current?.abort();
    clearTimeout(limite.current);
    audio.current?.pause();
    liberar.current?.();
    liberar.current = undefined;
    setAtual(null);
    mudarTocando(false);
  }, []);

  const alternar = useCallback(
    (id: string, obter: (sinal: AbortSignal) => Promise<FonteDaPrevia>) => {
      const mesma = atualRef.current?.id === id;
      parar();
      if (mesma) return;
      const numero = pedido.current;
      const meu = new AbortController();
      controle.current = meu;
      setErro(null);
      setAtual({ id, estado: "carregando" });
      obter(meu.signal).then(
        (fonte) => {
          if (numero !== pedido.current) return fonte.liberar?.();
          liberar.current = fonte.liberar;
          const elemento = (audio.current ??= criarAudio());
          elemento.src = fonte.url;
          elemento.currentTime = fonte.inicioS;
          elemento.volume = Math.min(1, Math.max(0, volume()));
          elemento.onended = () => numero === pedido.current && parar();
          void elemento.play().catch(() => numero === pedido.current && parar());
          limite.current = setTimeout(parar, DURACAO_DA_PREVIA_MS);
          setAtual({ id, estado: "tocando" });
          mudarTocando(true);
        },
        (e: unknown) => {
          if (numero !== pedido.current) return;
          setErro(e instanceof Error ? e.message : String(e));
          setAtual(null);
        },
      );
    },
    [parar, criarAudio, volume],
  );

  useEffect(() => parar, [parar]);

  const estadoDe = (id: string): EstadoDaPrevia => (atual?.id === id ? atual.estado : "parada");
  return { estadoDe, alternar, parar, erro };
}
