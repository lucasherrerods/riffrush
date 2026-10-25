import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, Loader2, Search } from "lucide-react";
import type { Personagem } from "@/modules/character";
import { TelaDeJogo, type OpcoesDaPartida, type Replay } from "@/modules/gameplay";
import { URL_DO_RELAY } from "@/modules/multiplayer";
import { idDoRanking, type Musica } from "@/modules/songs";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import { ATRASO_AO_VIVO, assistirTransmissao, inicioParaAssistir, precisaSincronizar } from "./espectador";
import { entradasDoLote, type PartidaTransmitida, type PessoaOnline } from "./protocolo";

interface Props {
  pessoa: PessoaOnline;
  musicas: Musica[];
  opcoes: OpcoesDaPartida;
  personagem: Personagem;
  aoSair: () => void;
  aoBuscarMusicas: () => void;
  urlDoRelay?: string;
  criarSocket?: Parameters<typeof assistirTransmissao>[3];
}

type Fase = "conectando" | "semPartida" | "semMusica" | "esperando" | "assistindo" | "pausado" | "fim";

interface Assistindo {
  musica: Musica;
  partida: PartidaTransmitida;
  replay: Replay;
  /** performance.now em que a música começa para quem assiste. */
  inicio: number;
  /** Muda a cada sincronização: a partida de quem assiste recomeça no ponto certo. */
  chave: number;
}

/** A partida de outra pessoa ao vivo, montada a partir das entradas dela, `ATRASO_AO_VIVO` segundos atrás. */
export function TelaDeEspectador({ pessoa, musicas, opcoes, personagem, aoSair, aoBuscarMusicas, urlDoRelay = URL_DO_RELAY, criarSocket }: Props) {
  const [fase, setFase] = useState<Fase>("conectando");
  const [assistindo, setAssistindo] = useState<Assistindo | null>(null);
  const musicasAtuais = useRef(musicas);
  musicasAtuais.current = musicas;

  useEffect(() => {
    let atual: Assistindo | null = null;
    let precisaRecomecar = true;
    let fimAgendado: ReturnType<typeof setTimeout> | undefined;
    const fechar = assistirTransmissao(
      urlDoRelay,
      pessoa.id,
      (mensagem) => {
        if (mensagem.tipo === "semPartida") return setFase("semPartida");
        if (mensagem.tipo === "inicio") {
          clearTimeout(fimAgendado);
          const musica = musicasAtuais.current.find((m) => idDoRanking(m) === mensagem.partida.musica);
          if (!musica) {
            atual = null;
            return setFase("semMusica");
          }
          const replay: Replay = { semFalha: mensagem.partida.semFalha, fantasma: false, hashDoChart: mensagem.partida.hashDoChart, entradas: [], ateAgora: 0 };
          atual = { musica, partida: mensagem.partida, replay, inicio: 0, chave: (atual?.chave ?? 0) + 1 };
          precisaRecomecar = true;
          return setFase("esperando");
        }
        if (!atual) return;
        if (mensagem.tipo === "lote") {
          // A mesma lista que a partida lê a cada quadro: as entradas novas valem sem remontar nada.
          atual.replay.entradas.push(...entradasDoLote(mensagem.entradas));
          atual.replay.ateAgora = mensagem.ate;
          const agora = performance.now();
          if (precisaRecomecar || precisaSincronizar(agora, atual.inicio, mensagem.ate)) {
            precisaRecomecar = false;
            atual = { ...atual, inicio: inicioParaAssistir(agora, mensagem.ate), chave: atual.chave + 1 };
            setAssistindo(atual);
            setFase("assistindo");
          }
        } else if (mensagem.tipo === "pausa") {
          if (!mensagem.pausado) return;
          precisaRecomecar = true;
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
  }, [pessoa.id, urlDoRelay, criarSocket]);

  useTeclado((evento) => fase !== "assistindo" && evento.code === "Escape" && aoSair());

  if (fase === "assistindo" && assistindo) {
    return (
      <div className="relative h-full">
        <TelaDeJogo
          key={assistindo.chave}
          musica={assistindo.musica}
          dificuldade={assistindo.partida.dificuldade}
          instrumento={assistindo.partida.instrumento}
          opcoes={{ ...opcoes, bot: false, semFalha: assistindo.partida.semFalha }}
          personagem={personagem}
          // Como numa sala: a música segue o relógio de quem joga, e a pausa só abre o menu.
          rede={{ inicio: assistindo.inicio, aoAtualizar: () => {} }}
          replay={assistindo.replay}
          aoSair={aoSair}
          aoTerminar={() => setFase("fim")}
        />
        <p className="pointer-events-none absolute top-20 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-superficie px-4 py-1 text-base font-bold">
          <Eye className="size-4 opacity-70" aria-hidden /> Assistindo {pessoa.nome}
        </p>
      </div>
    );
  }

  const encore = fase === "semMusica" && pessoa.estado.tipo === "tocando" && pessoa.estado.musica.startsWith("encore:");
  const mensagens: Record<Exclude<Fase, "assistindo">, string> = {
    conectando: `Conectando à partida de ${pessoa.nome}...`,
    esperando: `Conectando à partida de ${pessoa.nome}...`,
    semPartida: `${pessoa.nome} não está transmitindo uma partida agora.`,
    semMusica: `Para assistir, você precisa ter a música que ${pessoa.nome} está tocando.`,
    pausado: `${pessoa.nome} pausou a partida.`,
    fim: `A partida de ${pessoa.nome} terminou.`,
  };
  const carregando = fase === "conectando" || fase === "esperando" || fase === "assistindo";
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
      <p className="flex items-center gap-2 text-2xl font-black">
        {carregando && <Loader2 className="size-6 animate-spin opacity-70" aria-hidden />}
        {mensagens[fase === "assistindo" ? "esperando" : fase]}
      </p>
      {encore && <p className="text-base text-texto-suave">Ela é do Encore: baixe pela busca de músicas e volte para assistir.</p>}
      <div className="flex gap-4">
        {encore && (
          <Button size="lg" variant="outline" onClick={aoBuscarMusicas}>
            <Search className="opacity-70" /> Buscar músicas
          </Button>
        )}
        <Button size="lg" onClick={aoSair}>
          <ArrowLeft className="opacity-70" /> Voltar
        </Button>
      </div>
    </div>
  );
}
