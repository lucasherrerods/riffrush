import { useState, type ReactNode } from "react";
import { ArrowLeft, Library, Search, Settings2 } from "lucide-react";
import { LogoDoJogo } from "@/modules/menu";
import { sessaoDaConta, useConta, type RegistroDaPartida } from "@/modules/conta";
import { Avisos, avisar } from "@/shared/ui/avisos";
import { Button } from "@/shared/ui/button";
import { abrirBibliotecaDoMania, valeXpNoMania, type BibliotecaDoMania, type ConjuntoSalvo, type DificuldadeSalva } from "./beatmaps/biblioteca";
import { MODS } from "./gameplay/mods";
import { empacotarReplayDoMania } from "./gameplay/replay";
import { useBibliotecaDoMania } from "./beatmaps/useBibliotecaDoMania";
import { ResultadoDoMania } from "./gameplay/ResultadoDoMania";
import { TelaDeJogoMania, type MapaParaJogar, type OpcoesDoMania, type ResultadoDoMania as Resultado } from "./gameplay/TelaDeJogoMania";
import { TelaDeSelecaoMania } from "./selecao/TelaDeSelecaoMania";
import { carregarConfiguracoesDoMania, salvarConfiguracoesDoMania } from "./settings/configuracoesMania";
import { JanelaDeConfiguracoesMania } from "./settings/JanelaDeConfiguracoesMania";
import type { FiltrosDaBusca, MapaDaBusca, baixarOsz } from "./busca/api";
import { TelaDeBuscaMania } from "./busca/TelaDeBuscaMania";
import { useAtualizacaoAutomatica } from "@/modules/atualizacao";
import { cn } from "@/shared/lib/utils";
import { CirculoDeAcerto } from "./menu/CirculoDeAcerto";
import { FundoDoMania } from "./menu/FundoDoMania";
import { MenuDoMania } from "./menu/MenuDoMania";

type Tela = { nome: "menu" } | { nome: "selecao" } | { nome: "busca" } | { nome: "jogo"; mapa: MapaParaJogar; treino?: boolean } | { nome: "resultado"; mapa: MapaParaJogar; resultado: Resultado };

interface Props {
  /** A alavanca que volta para o Rock, no cabeçalho. */
  alavanca?: ReactNode;
  /** Para os testes. */
  abrirBiblioteca?: () => Promise<BibliotecaDoMania>;
  decodificar?: (contexto: AudioContext, bytes: Uint8Array) => Promise<AudioBuffer>;
  buscar?: (filtros: FiltrosDaBusca) => Promise<MapaDaBusca[]>;
  baixar?: typeof baixarOsz;
}

/** A raiz do Riff Rush Mania: seleção, partida e resultado. */
export function TelaDoMania({ alavanca, abrirBiblioteca = abrirBibliotecaDoMania, decodificar, buscar, baixar }: Props) {
  const { conjuntos, importar, guardarBaixado, usar, abrirPacote } = useBibliotecaDoMania(abrirBiblioteca);
  const [tela, setTela] = useState<Tela>({ nome: "menu" });
  useAtualizacaoAutomatica(tela.nome === "jogo");
  const [mods, setMods] = useState(0);
  const [opcoes, setOpcoes] = useState<OpcoesDoMania>(carregarConfiguracoesDoMania);
  const [configurando, setConfigurando] = useState(false);
  const mudarOpcoes = (novas: OpcoesDoMania) => {
    setOpcoes(novas);
    salvarConfiguracoesDoMania(novas);
  };
  const { conta } = useConta();
  const [xp, setXp] = useState<RegistroDaPartida | undefined>();
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

  const aoJogar = async (conjunto: ConjuntoSalvo, dificuldade: DificuldadeSalva, treino = false) => {
    const pacote = await abrirPacote(conjunto.id);
    const lido = pacote?.mapas.find((m) => m.hash === dificuldade.hash);
    const audio = lido && pacote?.arquivos.get(lido.arquivoDeAudio);
    if (!lido || !audio) return avisar.error("Não foi possível abrir este mapa.");
    void usar(conjunto.id);
    setSemente((Math.random() * 2 ** 32) >>> 0);
    setTela({
      nome: "jogo",
      treino,
      mapa: {
        titulo: conjunto.tituloUnicode || conjunto.titulo,
        dificuldade: lido.dificuldade,
        beatmapId: lido.beatmapId,
        valeXp: valeXpNoMania(conjunto) && !!lido.beatmapId,
        texto: lido.texto,
        hash: lido.hash,
        audio,
      },
    });
  };

  /** Com a conta conectada, o replay vai para a API, que confere a partida e devolve o XP. */
  const aoTerminar = (mapa: MapaParaJogar, resultado: Resultado) => {
    setTela({ nome: "resultado", mapa, resultado });
    setXp(undefined);
    if (!conta) return;
    if (!mapa.valeXp || !mapa.beatmapId || resultado.mods & MODS.AT) return setXp({ recusada: true });
    const beatmapId = mapa.beatmapId;
    setXp({ pendente: true, id: "" });
    void empacotarReplayDoMania({ mods: resultado.mods, semente: resultado.semente, hash: resultado.hash, entradas: resultado.entradas })
      .then((replay) => sessaoDaConta.registrarPartidaDoMania(beatmapId, replay))
      .then((registro) => (registro && "pendente" in registro ? sessaoDaConta.esperarXp(registro.id, { modo: "mania" }) : registro))
      .then((registro) => registro && setXp(registro))
      .catch(() => avisar.error("Não foi possível mandar a partida para a sua conta."));
  };

  if (tela.nome === "jogo")
    return (
      <TelaDeJogoMania
        mapa={tela.mapa}
        mods={mods}
        semente={semente}
        opcoes={opcoes}
        decodificar={decodificar}
        treino={tela.treino}
        aoSair={() => setTela({ nome: "selecao" })}
        aoTerminar={(resultado) => aoTerminar(tela.mapa, resultado)}
      />
    );

  if (tela.nome === "resultado")
    return (
      <ResultadoDoMania
        titulo={tela.mapa.titulo}
        dificuldade={tela.mapa.dificuldade}
        resultado={tela.resultado}
        xp={xp}
        valeXp={tela.mapa.valeXp}
        aoJogarDeNovo={() => setTela({ nome: "jogo", mapa: tela.mapa })}
        aoVoltar={() => setTela({ nome: "selecao" })}
      />
    );

  const janelaDeConfiguracoes = <JanelaDeConfiguracoesMania aberta={configurando} aoFechar={() => setConfigurando(false)} opcoes={opcoes} aoMudar={mudarOpcoes} />;

  if (tela.nome === "menu")
    return (
      <main className="relative flex h-dvh w-screen flex-col overflow-hidden bg-fundo text-texto">
        <FundoDoMania />
        <MenuDoMania alavanca={alavanca} aoJogar={() => setTela({ nome: "selecao" })} aoBuscar={() => setTela({ nome: "busca" })} aoConfigurar={() => setConfigurando(true)} />
        {janelaDeConfiguracoes}
        <Avisos />
      </main>
    );

  const aba = (nome: "selecao" | "busca", rotulo: string, icone: typeof Library) => {
    const ativa = tela.nome === nome;
    return (
      <button
        type="button"
        aria-current={ativa}
        onClick={() => setTela({ nome })}
        className={cn(
          "chapa flex items-center gap-2 py-1 pr-4 pl-1.5 font-titulo text-lg tracking-wide uppercase transition-colors",
          ativa ? "border-primaria bg-primaria text-superficie-elevada" : "border-borda bg-superficie-elevada text-texto-suave hover:text-texto",
        )}
      >
        <CirculoDeAcerto icone={icone} apagado={!ativa} className="size-6" />
        {rotulo}
      </button>
    );
  };

  return (
    <main className="relative flex h-dvh w-screen flex-col overflow-hidden bg-fundo text-texto">
      <FundoDoMania />
      <header className="relative flex items-center justify-between gap-4 border-b border-borda bg-superficie-elevada/80 px-6 py-3 backdrop-blur-sm max-md:flex-wrap max-md:px-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setTela({ nome: "menu" })} aria-label="Voltar ao menu">
            <ArrowLeft aria-hidden />
          </Button>
          <LogoDoJogo modo="Mania" pequena />
        </div>
        <nav aria-label="Telas do Mania" className="flex gap-2">
          {aba("selecao", "Biblioteca", Library)}
          {aba("busca", "Buscar mapas", Search)}
        </nav>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => setConfigurando(true)} aria-label="Configurações do Mania" className="rounded-full">
            <CirculoDeAcerto icone={Settings2} className="size-9" />
          </button>
          {alavanca}
        </div>
      </header>
      <div className="relative min-h-0 flex-1">
        {tela.nome === "busca" ? (
          <TelaDeBuscaMania baixados={baixados} aoBaixar={aoBaixar} buscar={buscar} baixar={baixar} />
        ) : (
          <TelaDeSelecaoMania conjuntos={conjuntos} mods={mods} aoMudarMods={setMods} aoImportar={aoImportar} aoJogar={aoJogar} aoTreinar={(conjunto, dificuldade) => void aoJogar(conjunto, dificuldade, true)} />
        )}
      </div>
      {janelaDeConfiguracoes}
      <Avisos />
    </main>
  );
}
