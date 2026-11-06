import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import { useAoVivo, type FaseAoVivo, type PessoaOnline } from "@/modules/presenca";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import type { ConjuntoSalvo, DificuldadeSalva } from "../beatmaps/biblioteca";
import { TelaDeJogoMania, type EntradaDoMania, type MapaParaJogar, type OpcoesDoMania } from "../gameplay/TelaDeJogoMania";
import { entradasDoLoteDoMania } from "./protocolo";

interface Props {
  pessoa: PessoaOnline;
  conjuntos: ConjuntoSalvo[];
  /** Abre o pacote do mapa achado na biblioteca. */
  carregarMapa: (conjunto: ConjuntoSalvo, dificuldade: DificuldadeSalva) => Promise<MapaParaJogar | null>;
  opcoes?: OpcoesDoMania;
  aoSair: () => void;
  aoBuscarMapas: () => void;
  decodificar?: (contexto: AudioContext, bytes: Uint8Array) => Promise<AudioBuffer>;
  urlDoRelay?: string;
  criarSocket?: (url: string) => { onmessage: ((evento: { data: string }) => void) | null; onclose: (() => void) | null; close(): void };
}

interface MapaAchado {
  conjunto: ConjuntoSalvo;
  dificuldade: DificuldadeSalva;
}

/** A partida de Mania de outra pessoa ao vivo: o mesmo mapa, mods e semente, com as entradas dela. */
export function TelaDeEspectadorMania({ pessoa, conjuntos, carregarMapa, opcoes, aoSair, aoBuscarMapas, decodificar, urlDoRelay, criarSocket }: Props) {
  const { fase, assistindo, terminar } = useAoVivo<MapaAchado, EntradaDoMania[]>({
    contaId: pessoa.id,
    urlDoRelay,
    criarSocket,
    biblioteca: conjuntos,
    achar: (partida) => {
      if (partida.modo !== "mania") return null;
      for (const conjunto of conjuntos) {
        const dificuldade = conjunto.mapas.find((m) => m.hash === partida.hashDoChart);
        if (dificuldade) return { conjunto, dificuldade };
      }
      return null;
    },
    montar: () => [],
    acumular: (entradas, lote) => entradas.push(...entradasDoLoteDoMania(lote)),
  });
  const [mapa, setMapa] = useState<MapaParaJogar | null>(null);
  const [erro, setErro] = useState(false);
  const achado = assistindo?.conteudo;
  useEffect(() => {
    if (!achado || mapa?.hash === achado.dificuldade.hash) return;
    let cancelado = false;
    carregarMapa(achado.conjunto, achado.dificuldade)
      .then((carregado) => !cancelado && (carregado ? setMapa(carregado) : setErro(true)))
      .catch(() => !cancelado && setErro(true));
    return () => {
      cancelado = true;
    };
  }, [achado, mapa?.hash, carregarMapa]);

  useTeclado((evento) => !assistindo && evento.code === "Escape" && aoSair());

  if (assistindo && mapa && !erro)
    return (
      <TelaDeJogoMania
        key={assistindo.chave}
        mapa={mapa}
        mods={assistindo.partida.mods ?? 0}
        semente={assistindo.partida.semente ?? 0}
        opcoes={opcoes}
        decodificar={decodificar}
        replay={assistindo.acumulado}
        rotuloDoReplay={`AO VIVO · ${pessoa.nome}`}
        aoVivo={{ inicio: assistindo.inicio }}
        aoSair={aoSair}
        aoTerminar={terminar}
      />
    );

  const mensagens: Record<FaseAoVivo, string> = {
    conectando: `Conectando à partida de ${pessoa.nome}...`,
    esperando: `Conectando à partida de ${pessoa.nome}...`,
    assistindo: `Conectando à partida de ${pessoa.nome}...`,
    semPartida: `${pessoa.nome} não está transmitindo uma partida agora.`,
    semConteudo: `Para assistir, você precisa ter o mapa que ${pessoa.nome} está jogando.`,
    pausado: `${pessoa.nome} pausou a partida.`,
    fim: `A partida de ${pessoa.nome} terminou.`,
  };
  const carregando = !erro && (fase === "conectando" || fase === "esperando" || fase === "assistindo");
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
      <p className="flex items-center gap-2 text-2xl font-black">
        {carregando && <Loader2 className="size-6 animate-spin opacity-70" aria-hidden />}
        {erro ? "Não foi possível abrir este mapa." : mensagens[fase]}
      </p>
      <div className="flex gap-4">
        {fase === "semConteudo" && (
          <Button size="lg" variant="outline" onClick={aoBuscarMapas}>
            <Search className="opacity-70" /> Buscar mapas
          </Button>
        )}
        <Button size="lg" onClick={aoSair}>
          <ArrowLeft className="opacity-70" /> Voltar
        </Button>
      </div>
    </div>
  );
}
