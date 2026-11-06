import { useState } from "react";
import { ArrowLeft, Download, Eye, Loader2, Search } from "lucide-react";
import type { Personagem } from "@/modules/rock/character";
import { TelaDeJogo, type OpcoesDaPartida, type Replay } from "@/modules/rock/gameplay";
import { URL_DO_RELAY } from "@/modules/multiplayer";
import { linkDoChartConfere } from "@/modules/rock/search";
import { idDoRanking, type Dificuldade, type Instrumento, type Musica } from "@/modules/rock/songs";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import type { assistirTransmissao } from "./espectador";
import { entradasDoLote, type PessoaOnline } from "./protocolo";
import { useAoVivo, type FaseAoVivo } from "./useAoVivo";

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

/** A partida de outra pessoa ao vivo, montada a partir das entradas dela, `ATRASO_AO_VIVO` segundos atrás. */
export function TelaDeEspectador({ pessoa, musicas, opcoes, personagem, aoSair, aoBuscarMusicas, aoBaixar, urlDoRelay = URL_DO_RELAY, criarSocket }: Props) {
  const [baixando, setBaixando] = useState(false);
  const [erroAoBaixar, setErroAoBaixar] = useState<string | null>(null);
  const { fase, partida, assistindo, terminar } = useAoVivo<Musica, Replay>({
    contaId: pessoa.id,
    urlDoRelay,
    criarSocket,
    biblioteca: musicas,
    // Uma partida do Mania não tem música do Rock para montar.
    achar: (p) => (p.modo === "mania" ? null : (musicas.find((m) => idDoRanking(m) === p.musica) ?? null)),
    montar: (p) => ({ semFalha: p.semFalha, velocidade: p.velocidade ?? 1, fantasma: false, semAberta: p.semAberta ?? false, jeito: p.jeito ?? "gamepad", hashDoChart: p.hashDoChart, entradas: [], ateAgora: 0 }),
    acumular: (replay, lote, ate) => {
      replay.entradas.push(...entradasDoLote(lote));
      replay.ateAgora = ate;
    },
  });

  useTeclado((evento) => fase !== "assistindo" && evento.code === "Escape" && aoSair());

  if (assistindo) {
    return (
      <div className="relative h-full">
        <TelaDeJogo
          key={assistindo.chave}
          musica={assistindo.conteudo}
          dificuldade={assistindo.partida.dificuldade as Dificuldade}
          instrumento={assistindo.partida.instrumento as Instrumento}
          opcoes={{ ...opcoes, bot: false, semFalha: assistindo.partida.semFalha }}
          personagem={personagem}
          // Como numa sala: a música segue o relógio de quem joga, e a pausa só abre o menu.
          rede={{ inicio: assistindo.inicio, aoAtualizar: () => {} }}
          replay={assistindo.acumulado}
          aoSair={aoSair}
          aoTerminar={terminar}
        />
        <p className="pointer-events-none absolute top-20 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-superficie px-4 py-1 text-base font-bold">
          <Eye className="size-4 opacity-70" aria-hidden /> Assistindo {pessoa.nome}
        </p>
      </div>
    );
  }

  // O app confere o link de novo, sem confiar só no relay: tem que ser um chart do Encore e desta música.
  const link = fase === "semConteudo" && partida && linkDoChartConfere(partida.urlDoEncore, partida.musica) ? partida.urlDoEncore : null;
  const doEncore = fase === "semConteudo" && !!partida?.musica.startsWith("encore:");
  const baixar = (url: string) => {
    setBaixando(true);
    setErroAoBaixar(null);
    aoBaixar(url, partida!.musica.slice("encore:".length))
      .catch((erro) => setErroAoBaixar(erro instanceof Error ? erro.message : String(erro)))
      .finally(() => setBaixando(false));
  };

  const mensagens: Record<Exclude<FaseAoVivo, "assistindo">, string> = {
    conectando: `Conectando à partida de ${pessoa.nome}...`,
    esperando: `Conectando à partida de ${pessoa.nome}...`,
    semPartida: `${pessoa.nome} não está transmitindo uma partida agora.`,
    semConteudo: `Para assistir, você precisa ter a música que ${pessoa.nome} está tocando.`,
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
