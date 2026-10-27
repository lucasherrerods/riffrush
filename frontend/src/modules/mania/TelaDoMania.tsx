import { useState } from "react";
import { Avisos, avisar } from "@/shared/ui/avisos";
import { Button } from "@/shared/ui/button";
import { abrirBibliotecaDoMania, type BibliotecaDoMania, type ConjuntoSalvo, type DificuldadeSalva } from "./beatmaps/biblioteca";
import { useBibliotecaDoMania } from "./beatmaps/useBibliotecaDoMania";
import { ResultadoDoMania } from "./gameplay/ResultadoDoMania";
import { TelaDeJogoMania, type MapaParaJogar, type ResultadoDoMania as Resultado } from "./gameplay/TelaDeJogoMania";
import { IDENTIDADE_DO_MANIA } from "./identidade";
import { TelaDeSelecaoMania } from "./selecao/TelaDeSelecaoMania";
import type { FiltrosDaBusca, MapaDaBusca, baixarOsz } from "./busca/api";
import { TelaDeBuscaMania } from "./busca/TelaDeBuscaMania";

type Tela = { nome: "selecao" } | { nome: "busca" } | { nome: "jogo"; mapa: MapaParaJogar } | { nome: "resultado"; mapa: MapaParaJogar; resultado: Resultado };

interface Props {
  /** Volta para o Riff Rush Rock. */
  aoTrocarDeModo?: () => void;
  /** Para os testes. */
  abrirBiblioteca?: () => Promise<BibliotecaDoMania>;
  decodificar?: (contexto: AudioContext, bytes: Uint8Array) => Promise<AudioBuffer>;
  buscar?: (filtros: FiltrosDaBusca) => Promise<MapaDaBusca[]>;
  baixar?: typeof baixarOsz;
}

/** A raiz do Riff Rush Mania: seleção, partida e resultado. */
export function TelaDoMania({ aoTrocarDeModo, abrirBiblioteca = abrirBibliotecaDoMania, decodificar, buscar, baixar }: Props) {
  const { conjuntos, importar, guardarBaixado, usar, abrirPacote } = useBibliotecaDoMania(abrirBiblioteca);
  const [tela, setTela] = useState<Tela>({ nome: "selecao" });
  const [mods, setMods] = useState(0);
  // A semente do Random muda a cada partida; o replay a guarda.
  const [semente, setSemente] = useState(() => (Math.random() * 2 ** 32) >>> 0);

  const aoImportar = async (arquivos: File[]) => {
    const { importados, erros } = await importar(arquivos);
    if (importados.length) avisar(importados.length === 1 ? `${importados[0].titulo} importado` : `${importados.length} mapas importados`);
    for (const { arquivo, motivo } of erros) avisar.error(`${arquivo}: ${motivo}`);
  };

  const aoBaixar = async (osz: Blob, mapa: MapaDaBusca) => {
    const estrelas = Object.fromEntries(mapa.dificuldades.map((d) => [d.hash, d.estrelas]));
    try {
      await guardarBaixado(osz, { status: mapa.status, estrelas });
      avisar(`${mapa.titulo} baixado`);
    } catch (erro) {
      avisar.error(`${mapa.titulo}: ${erro instanceof Error ? erro.message : String(erro)}`);
    }
  };
  const baixados = new Set((conjuntos ?? []).flatMap((c) => (c.origem === "osu" && c.beatmapsetId ? [c.beatmapsetId] : [])));

  const aoJogar = async (conjunto: ConjuntoSalvo, dificuldade: DificuldadeSalva) => {
    const pacote = await abrirPacote(conjunto.id);
    const lido = pacote?.mapas.find((m) => m.hash === dificuldade.hash);
    const audio = lido && pacote?.arquivos.get(lido.arquivoDeAudio);
    if (!lido || !audio) return avisar.error("Não foi possível abrir este mapa.");
    void usar(conjunto.id);
    setSemente((Math.random() * 2 ** 32) >>> 0);
    setTela({ nome: "jogo", mapa: { titulo: conjunto.tituloUnicode || conjunto.titulo, dificuldade: lido.dificuldade, texto: lido.texto, hash: lido.hash, audio } });
  };

  if (tela.nome === "jogo")
    return (
      <TelaDeJogoMania
        mapa={tela.mapa}
        mods={mods}
        semente={semente}
        decodificar={decodificar}
        aoSair={() => setTela({ nome: "selecao" })}
        aoTerminar={(resultado) => setTela({ nome: "resultado", mapa: tela.mapa, resultado })}
      />
    );

  if (tela.nome === "resultado")
    return (
      <ResultadoDoMania
        titulo={tela.mapa.titulo}
        dificuldade={tela.mapa.dificuldade}
        resultado={tela.resultado}
        aoJogarDeNovo={() => setTela({ nome: "jogo", mapa: tela.mapa })}
        aoVoltar={() => setTela({ nome: "selecao" })}
      />
    );

  return (
    <main className="flex h-full flex-col bg-fundo text-texto">
      <header className="flex items-center justify-between border-b border-borda px-6 py-4">
        <h1 className="font-titulo text-4xl tracking-wide">{IDENTIDADE_DO_MANIA.nome}</h1>
        <nav aria-label="Telas do Mania" className="flex gap-2">
          <Button variant={tela.nome === "selecao" ? "default" : "secondary"} aria-current={tela.nome === "selecao"} onClick={() => setTela({ nome: "selecao" })}>
            Biblioteca
          </Button>
          <Button variant={tela.nome === "busca" ? "default" : "secondary"} aria-current={tela.nome === "busca"} onClick={() => setTela({ nome: "busca" })}>
            Buscar mapas
          </Button>
        </nav>
        {aoTrocarDeModo && (
          <Button variant="secondary" onClick={aoTrocarDeModo}>
            Ir para o Rock
          </Button>
        )}
      </header>
      {tela.nome === "busca" ? (
        <TelaDeBuscaMania baixados={baixados} aoBaixar={aoBaixar} buscar={buscar} baixar={baixar} />
      ) : (
        <TelaDeSelecaoMania conjuntos={conjuntos} mods={mods} aoMudarMods={setMods} aoImportar={aoImportar} aoJogar={aoJogar} />
      )}
      <Avisos />
    </main>
  );
}
