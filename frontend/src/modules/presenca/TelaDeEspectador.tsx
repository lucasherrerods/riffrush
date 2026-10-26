import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, Eye, Loader2, Search } from "lucide-react";
import type { Personagem } from "@/modules/character";
import { TelaDeJogo, type OpcoesDaPartida, type Replay } from "@/modules/gameplay";
import { URL_DO_RELAY } from "@/modules/multiplayer";
import { linkDoChartConfere } from "@/modules/search";
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
  /** Baixa e importa o chart do Encore; quando a música aparece em `musicas`, a partida começa sozinha. */
  aoBaixar: (url: string, md5: string) => Promise<void>;
  urlDoRelay?: string;
  criarSocket?: Parameters<typeof assistirTransmissao>[3];
}

type Fase = "conectando" | "semPartida" | "semMusica" | "esperando" | "assistindo" | "pausado" | "fim";

/** A transmissão recebida até agora. As entradas chegam mesmo sem a música, para quem baixa no meio entrar já sincronizado. */
interface Transmissao {
  partida: PartidaTransmitida;
  replay: Replay;
}

interface Assistindo extends Transmissao {
  musica: Musica;
  /** performance.now em que a música começa para quem assiste. */
  inicio: number;
  /** Muda a cada sincronização: a partida de quem assiste recomeça no ponto certo. */
  chave: number;
}

/** A partida de outra pessoa ao vivo, montada a partir das entradas dela, `ATRASO_AO_VIVO` segundos atrás. */
export function TelaDeEspectador({ pessoa, musicas, opcoes, personagem, aoSair, aoBuscarMusicas, aoBaixar, urlDoRelay = URL_DO_RELAY, criarSocket }: Props) {
  const [fase, setFase] = useState<Fase>("conectando");
  const [assistindo, setAssistindo] = useState<Assistindo | null>(null);
  const [transmissao, setTransmissao] = useState<Transmissao | null>(null);
  const [baixando, setBaixando] = useState(false);
  const [erroAoBaixar, setErroAoBaixar] = useState<string | null>(null);
  // Lidos pelo socket, que vive o tempo todo da tela.
  const musicaDaPartida = useRef<Musica | null>(null);
  const precisaRecomecar = useRef(true);
  const chave = useRef(0);

  const acharMusica = (partida: PartidaTransmitida) => musicas.find((m) => idDoRanking(m) === partida.musica) ?? null;
  const acharMusicaAtual = useRef(acharMusica);
  acharMusicaAtual.current = acharMusica;

  useEffect(() => {
    let atual: Transmissao | null = null;
    let inicioAtual = 0;
    let fimAgendado: ReturnType<typeof setTimeout> | undefined;

    const comecar = (ate: number) => {
      if (!atual || !musicaDaPartida.current) return;
      precisaRecomecar.current = false;
      inicioAtual = inicioParaAssistir(performance.now(), ate);
      setAssistindo({ ...atual, musica: musicaDaPartida.current, inicio: inicioAtual, chave: ++chave.current });
      setFase("assistindo");
    };

    const fechar = assistirTransmissao(
      urlDoRelay,
      pessoa.id,
      (mensagem) => {
        if (mensagem.tipo === "semPartida") return setFase("semPartida");
        if (mensagem.tipo === "inicio") {
          clearTimeout(fimAgendado);
          const replay: Replay = { semFalha: mensagem.partida.semFalha, velocidade: mensagem.partida.velocidade ?? 1, fantasma: false, hashDoChart: mensagem.partida.hashDoChart, entradas: [], ateAgora: 0 };
          atual = { partida: mensagem.partida, replay };
          setTransmissao(atual);
          musicaDaPartida.current = acharMusicaAtual.current(mensagem.partida);
          precisaRecomecar.current = true;
          return setFase(musicaDaPartida.current ? "esperando" : "semMusica");
        }
        if (!atual) return;
        if (mensagem.tipo === "lote") {
          // A mesma lista que a partida lê a cada quadro: as entradas novas valem sem remontar nada.
          atual.replay.entradas.push(...entradasDoLote(mensagem.entradas));
          atual.replay.ateAgora = mensagem.ate;
          if (!musicaDaPartida.current) return;
          if (precisaRecomecar.current || precisaSincronizar(performance.now(), inicioAtual, mensagem.ate)) comecar(mensagem.ate);
        } else if (mensagem.tipo === "pausa") {
          if (!mensagem.pausado || !musicaDaPartida.current) return;
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
  }, [pessoa.id, urlDoRelay, criarSocket]);

  // A música baixada entrou na biblioteca: a partida começa no próximo lote, já no ponto certo.
  useEffect(() => {
    if (fase !== "semMusica" || !transmissao) return;
    const musica = acharMusica(transmissao.partida);
    if (!musica) return;
    musicaDaPartida.current = musica;
    precisaRecomecar.current = true;
    setFase("esperando");
  }, [musicas, fase, transmissao]);

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

  // O app confere o link de novo, sem confiar só no relay: tem que ser um chart do Encore e desta música.
  const link = fase === "semMusica" && transmissao && linkDoChartConfere(transmissao.partida.urlDoEncore, transmissao.partida.musica) ? transmissao.partida.urlDoEncore : null;
  const doEncore = fase === "semMusica" && !!transmissao?.partida.musica.startsWith("encore:");
  const baixar = (url: string) => {
    setBaixando(true);
    setErroAoBaixar(null);
    aoBaixar(url, transmissao!.partida.musica.slice("encore:".length))
      .catch((erro) => setErroAoBaixar(erro instanceof Error ? erro.message : String(erro)))
      .finally(() => setBaixando(false));
  };

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
      {link && <p className="text-base text-texto-suave">Ela é do Encore: baixe agora e a partida começa sozinha, ao vivo.</p>}
      {!link && doEncore && <p className="text-base text-texto-suave">Ela é do Encore: baixe pela busca de músicas e volte para assistir.</p>}
      {erroAoBaixar && (
        <p role="alert" className="text-base text-texto-suave">
          {erroAoBaixar}
        </p>
      )}
      <div className="flex gap-4">
        {link && (
          <Button size="lg" disabled={baixando} onClick={() => baixar(link)}>
            {baixando ? <Loader2 className="animate-spin opacity-70" /> : <Download className="opacity-70" />} {baixando ? "Baixando..." : "Baixar e assistir"}
          </Button>
        )}
        {!link && doEncore && (
          <Button size="lg" variant="outline" onClick={aoBuscarMusicas}>
            <Search className="opacity-70" /> Buscar músicas
          </Button>
        )}
        <Button size="lg" variant={link ? "outline" : "default"} onClick={aoSair}>
          <ArrowLeft className="opacity-70" /> Voltar
        </Button>
      </div>
    </div>
  );
}
