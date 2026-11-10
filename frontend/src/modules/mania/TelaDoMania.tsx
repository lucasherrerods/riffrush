import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { PARTE_DA_TELA_DO_MODO, type PalcoCompartilhado } from "@/modules/menu";
import { CartaoDaConta, PerfilDoAmigo, TelaDePerfil, contasLigadas, sessaoDaConta, useConta, type RegistroDaPartida } from "@/modules/conta";
import { BotaoDeAmigos, PainelDeAmigos, useIdsDosAmigos } from "@/modules/amigos";
import {
  ChatGlobal,
  TelaOnline,
  abrirCanalDeTransmissao,
  assistirNoModoCerto,
  presenca,
  presencaDisponivel,
  tirarPedidoDeAssistir,
  usePresenca,
  useSouDaModeracao,
  type PessoaOnline,
  type PreferenciasOnline,
} from "@/modules/presenca";
import { entradasParaOLoteDoMania, estadoTocandoNoMania, partidaParaTransmitirNoMania, type MapaAoVivo } from "./aoVivo/protocolo";
import { TelaDeEspectadorMania } from "./aoVivo/TelaDeEspectadorMania";
import { TelaDeLeaderboard } from "@/modules/ranking";
import { carregarConfiguracoes, salvarConfiguracoes } from "@/modules/settings";
import { AnimatePresence, motion } from "framer-motion";
import { AbaDosMapasMaisJogados } from "./ranking/AbaDosMapasMaisJogados";
import { EstatisticasDoMania } from "./perfil/EstatisticasDoMania";
import { cn } from "@/shared/lib/utils";
import { Avisos, avisar } from "@/shared/ui/avisos";
import { abrirBibliotecaDoMania, beatmapIdParaAApi, valeXpNoMania, type BibliotecaDoMania, type ConjuntoSalvo, type DificuldadeSalva } from "./beatmaps/biblioteca";
import { MODS } from "./gameplay/mods";
import { empacotarReplayDoMania, lerReplayDoMania, type ReplayDoMania } from "./gameplay/replay";
import { apiDoRanking, type PosicaoNoRankingDoMania } from "./ranking/api";
import { useBibliotecaDoMania } from "./beatmaps/useBibliotecaDoMania";
import { ResultadoDoMania } from "./gameplay/ResultadoDoMania";
import { TelaDeJogoMania, type EventoDoManiaAoVivo, type MapaParaJogar, type OpcoesDoMania, type ResultadoDoMania as Resultado } from "./gameplay/TelaDeJogoMania";
import { TelaDeSelecaoMania } from "./selecao/TelaDeSelecaoMania";
import { carregarConfiguracoesDoMania, salvarConfiguracoesDoMania } from "./settings/configuracoesMania";
import { JanelaDeConfiguracoesMania } from "./settings/JanelaDeConfiguracoesMania";
import { baixarOsz, buscarMapas, type FiltrosDaBusca, type MapaDaBusca, type PaginaDaBusca } from "./busca/api";
import { sortearMapa } from "./busca/sortear";
import { TelaDeBuscaMania } from "./busca/TelaDeBuscaMania";
import { useAtualizacaoAutomatica } from "@/modules/atualizacao";
import { definirVolumeGeral, useVolumeGeral } from "@/modules/audio";
import { CabecalhoDoPlayerDeMusica, type FaixaDoPlayer, type PlayerDeMusica } from "@/modules/player";
import { criarPlayerDoMania, faixasDaBiblioteca, playerDoMania } from "./player/trilhaDoMania";
import { FundoDoMania } from "./menu/FundoDoMania";
import { MenuDoMania } from "./menu/MenuDoMania";

type Tela = { nome: "menu" } | { nome: "selecao"; conjuntoId?: string } | { nome: "busca"; veioDaSelecao?: boolean } | { nome: "leaderboard" } | { nome: "perfil"; amigo?: string } | { nome: "online" } | { nome: "espectador"; pessoa: PessoaOnline } | { nome: "jogo"; mapa: MapaParaJogar; aoVivo: MapaAoVivo; treino?: boolean; replay?: ReplayAssistido } | { nome: "resultado"; mapa: MapaParaJogar; aoVivo: MapaAoVivo; resultado: Resultado; replay?: ReplayAssistido };

/** Um replay do ranking aberto para assistir: as entradas, os mods e a semente da partida, e de quem ela é. */
type ReplayAssistido = ReplayDoMania & { nome: string };

interface Props {
  /** A alavanca que volta para o Rock, na tela inicial. */
  alavanca?: ReactNode;
  /** Com a tela inicial compartilhada, o disco do app fica atrás dela no lugar do fundo do Mania. */
  palco?: PalcoCompartilhado;
  /** Para os testes. */
  abrirBiblioteca?: () => Promise<BibliotecaDoMania>;
  decodificar?: (contexto: AudioContext, bytes: Uint8Array) => Promise<AudioBuffer>;
  buscar?: (filtros: FiltrosDaBusca) => Promise<PaginaDaBusca>;
  baixar?: typeof baixarOsz;
}

/** A raiz do Riff Rush Mania: seleção, partida e resultado. */
export function TelaDoMania({ alavanca, palco, abrirBiblioteca = abrirBibliotecaDoMania, decodificar, buscar, baixar }: Props) {
  const { conjuntos, importar, guardarBaixado, usar, abrirPacote } = useBibliotecaDoMania(abrirBiblioteca);
  const [tela, setTela] = useState<Tela>({ nome: "menu" });
  const souDaModeracao = useSouDaModeracao();
  const [amigosAbertos, setAmigosAbertos] = useState(false);
  useAtualizacaoAutomatica(tela.nome === "jogo");
  // A trilha dos menus: as músicas da biblioteca, no mesmo player do cabeçalho do Rock.
  const player = useMemo(() => (decodificar ? criarPlayerDoMania(undefined, decodificar) : playerDoMania), [decodificar]);
  const faixas = useMemo(() => faixasDaBiblioteca(conjuntos ?? [], abrirPacote), [conjuntos, abrirPacote]);
  useEffect(() => {
    player.definirFila(faixas);
    if (!player.estado().musica && faixas[0]) player.seguir(faixas[0]);
  }, [player, faixas]);
  // Na partida a pista toca a música do mapa; nos menus a trilha volta aos poucos.
  useEffect(() => player.suspender(tela.nome === "jogo", { esmaecer: tela.nome !== "jogo" }), [player, tela.nome]);
  // Na troca de modo, a trilha do Mania some aos poucos enquanto o disco gira, e volta quando o Mania volta.
  useEffect(() => {
    player.suspender(false, { esmaecer: true });
    return () => player.suspender(true, { esmaecer: true });
  }, [player]);
  const { volume } = useVolumeGeral();
  const cabecalho = (
    <CabecalhoDoPlayerDeMusica player={player as unknown as PlayerDeMusica<FaixaDoPlayer>} volume={volume} aoMudarVolume={definirVolumeGeral}>
      {contasLigadas && <BotaoDeAmigos aberto={amigosAbertos} aoAlternar={() => setAmigosAbertos((abertos) => !abertos)} />}
      {contasLigadas && <CartaoDaConta mod={souDaModeracao} aoConfigurar={() => setConfigurando(true)} aoVerPerfil={() => setTela({ nome: "perfil" })} />}
    </CabecalhoDoPlayerDeMusica>
  );
  const painelDeAmigos = (
    <AnimatePresence>
      {amigosAbertos && (
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-y-0 right-0 z-30 p-4 max-md:inset-x-0 max-md:p-2"
        >
          <PainelDeAmigos
            aoFechar={() => setAmigosAbertos(false)}
            aoConvidar={(contaId, codigo) => presenca.convidar(contaId, codigo)}
            aoVerPerfil={(amigo) => {
              setAmigosAbertos(false);
              setTela({ nome: "perfil", amigo: amigo.conta_id });
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
  const aoMudarDeTela = palco?.aoMudarDeTela;
  useEffect(() => aoMudarDeTela?.(tela.nome === "menu"), [tela.nome, aoMudarDeTela]);
  const [mods, setMods] = useState(0);
  const [opcoes, setOpcoes] = useState<OpcoesDoMania>(carregarConfiguracoesDoMania);
  const [configurando, setConfigurando] = useState(false);
  const mudarOpcoes = (novas: OpcoesDoMania) => {
    setOpcoes(novas);
    salvarConfiguracoesDoMania(novas);
  };
  const { conta } = useConta();
  const [xp, setXp] = useState<RegistroDaPartida | undefined>();
  // As preferências do online e do chat são da conta, guardadas junto com as do Rock.
  const [preferencias, setPreferencias] = useState(carregarConfiguracoes);
  const responderAoChat = (chatGlobal: boolean) => {
    const novas = { ...carregarConfiguracoes(), chatGlobal };
    salvarConfiguracoes(novas);
    setPreferencias(novas);
  };
  // Aparece online no Mania como no Rock: com conta, relay e a escolha de aparecer.
  const online = presencaDisponivel && contasLigadas && !!conta && preferencias.mostrarOnline === true;
  useEffect(() => {
    if (online) presenca.ligar();
  }, [online]);
  // A partida vai ao ar como no Rock: com a conta online e a escolha de deixar assistir. Replay e treino não vão.
  const jogando = tela.nome === "jogo" && !tela.replay && !tela.treino ? tela : null;
  const transmitindo = online && preferencias.permitirEspectadores && !!jogando;
  useEffect(
    () => presenca.definirEstado(jogando ? estadoTocandoNoMania(jogando.aoVivo, transmitindo) : tela.nome === "selecao" ? { tipo: "selecao" } : { tipo: "menu" }),
    [tela.nome, jogando, transmitindo],
  );
  const mudarPreferencias = (mudadas: Partial<PreferenciasOnline>) => {
    const novas = { ...carregarConfiguracoes(), ...mudadas };
    salvarConfiguracoes(novas);
    setPreferencias(novas);
  };
  // Veio do Rock para assistir alguém que está no Mania.
  useEffect(() => {
    const pessoa = tirarPedidoDeAssistir();
    if (pessoa) setTela({ nome: "espectador", pessoa });
  }, []);
  const idsDosAmigos = useIdsDosAmigos(contasLigadas && !!conta && tela.nome === "online");
  const estadoDaPresenca = usePresenca();
  const assistir = (pessoa: PessoaOnline) => {
    setAmigosAbertos(false);
    assistirNoModoCerto(pessoa, "mania", (p) => setTela({ nome: "espectador", pessoa: p }));
  };
  // A semente do Random muda a cada partida; o replay a guarda.
  const [semente, setSemente] = useState(() => (Math.random() * 2 ** 32) >>> 0);
  // Uma transmissão por partida: jogar de novo é outra tela de jogo e ganha outra.
  const canal = useMemo(() => (transmitindo && conta ? abrirCanalDeTransmissao(conta.id) : undefined), [transmitindo, conta?.id, jogando]); // eslint-disable-line react-hooks/exhaustive-deps
  const transmitir = (evento: EventoDoManiaAoVivo) => {
    if (!canal || !jogando) return;
    if (evento.tipo === "inicio") canal.comecar(partidaParaTransmitirNoMania(jogando.aoVivo, mods, semente));
    else if (evento.tipo === "lote") canal.mandar({ tipo: "lote", ate: evento.ate, entradas: entradasParaOLoteDoMania(evento.entradas) });
    else canal.encerrar();
  };
  /** Abre o pacote de uma dificuldade da biblioteca, pronto para jogar. */
  const carregarMapa = useCallback(
    async (conjunto: ConjuntoSalvo, dificuldade: DificuldadeSalva): Promise<MapaParaJogar | null> => {
      const pacote = await abrirPacote(conjunto.id);
      const lido = pacote?.mapas.find((m) => m.hash === dificuldade.hash);
      const audio = lido && pacote?.arquivos.get(lido.arquivoDeAudio);
      if (!lido || !audio) return null;
      return {
        titulo: conjunto.tituloUnicode || conjunto.titulo,
        dificuldade: lido.dificuldade,
        beatmapId: beatmapIdParaAApi(conjunto, lido.beatmapId),
        valeXp: valeXpNoMania(conjunto) && !!lido.beatmapId,
        texto: lido.texto,
        hash: lido.hash,
        audio,
      };
    },
    [abrirPacote],
  );

  const aoImportar = async (arquivos: File[]) => {
    const { importados, erros } = await importar(arquivos);
    if (importados.length) avisar(importados.length === 1 ? `${importados[0].titulo} importado` : `${importados.length} mapas importados`);
    for (const { arquivo, motivo } of erros) avisar.error(`${arquivo}: ${motivo}`);
  };

  const guardarDaBusca = (osz: Blob, mapa: MapaDaBusca) => guardarBaixado(osz, { status: mapa.status, estrelas: Object.fromEntries(mapa.dificuldades.map((d) => [d.hash, d.estrelas])) });
  const aoBaixar = async (osz: Blob, mapa: MapaDaBusca) => {
    try {
      await guardarDaBusca(osz, mapa);
      avisar(`${mapa.titulo} baixado`);
    } catch (erro) {
      avisar.error(`${mapa.titulo}: ${erro instanceof Error ? erro.message : String(erro)}`);
    }
  };
  const baixados = new Set((conjuntos ?? []).flatMap((c) => (c.origem === "osu" && c.beatmapsetId ? [c.beatmapsetId] : [])));
  /** Como a Aleatória do Rock: baixa um mapa ranked novo e o deixa selecionado. */
  const sortearMapaNovo = async (teclas: number | "todas") => {
    const mapa = await sortearMapa(teclas, { buscar: buscar ?? buscarMapas, baixados });
    const osz = await (baixar ?? baixarOsz)(mapa.beatmapsetId);
    await guardarDaBusca(osz, mapa);
    setTela({ nome: "selecao", conjuntoId: `osu:${mapa.beatmapsetId}` });
  };

  const aoJogar = async (conjunto: ConjuntoSalvo, dificuldade: DificuldadeSalva, treino = false, replay?: ReplayAssistido) => {
    const mapa = await carregarMapa(conjunto, dificuldade);
    if (!mapa) return avisar.error("Não foi possível abrir este mapa.");
    void usar(conjunto.id);
    setSemente((Math.random() * 2 ** 32) >>> 0);
    const teclas = conjunto.mapas.find((m) => m.hash === dificuldade.hash)?.teclas ?? dificuldade.teclas;
    setTela({
      nome: "jogo",
      treino,
      replay,
      mapa,
      aoVivo: { titulo: mapa.titulo, artista: conjunto.artistaUnicode || conjunto.artista, dificuldade: mapa.dificuldade, teclas, hash: mapa.hash },
    });
  };

  /** Como no Rock: baixa o replay da partida do ranking, confere que é desta dificuldade e assiste no mapa da biblioteca. */
  const aoAssistir = async (conjunto: ConjuntoSalvo, dificuldade: DificuldadeSalva, linha: PosicaoNoRankingDoMania) => {
    const replay = await apiDoRanking
      .replay(linha.partida_id)
      .then(lerReplayDoMania)
      .catch(() => null);
    if (!replay) return avisar.error("Não deu para baixar este replay agora.");
    if (replay.hash !== dificuldade.hash) return avisar.error("Este replay é de outra versão do mapa.");
    await aoJogar(conjunto, dificuldade, false, { ...replay, nome: linha.nome });
  };

  /** Com a conta conectada, o replay vai para a API, que confere a partida e devolve o XP. Fora do ranked ela vai também,
   * sem XP, para aparecer no ranking com todas as partidas. Replay assistido não vale nada. */
  const aoTerminar = (mapa: MapaParaJogar, aoVivo: MapaAoVivo, resultado: Resultado, replay?: ReplayAssistido) => {
    setTela({ nome: "resultado", mapa, aoVivo, resultado, replay });
    setXp(undefined);
    if (!conta || replay) return;
    if (!mapa.beatmapId || resultado.mods & MODS.AT) return setXp({ recusada: true });
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
        mods={tela.replay?.mods ?? mods}
        semente={tela.replay?.semente ?? semente}
        opcoes={opcoes}
        decodificar={decodificar}
        treino={tela.treino}
        replay={tela.replay?.entradas}
        rotuloDoReplay={tela.replay && `REPLAY · ${tela.replay.nome}`}
        aoSair={() => setTela({ nome: "selecao" })}
        aoTransmitir={canal && transmitir}
        aoTerminar={(resultado) => aoTerminar(tela.mapa, tela.aoVivo, resultado, tela.replay)}
      />
    );

  if (tela.nome === "resultado")
    return (
      <ResultadoDoMania
        titulo={tela.mapa.titulo}
        dificuldade={tela.mapa.dificuldade}
        resultado={tela.resultado}
        xp={xp}
        valeXp={tela.mapa.valeXp && !tela.replay}
        aoJogarDeNovo={() => setTela({ nome: "jogo", mapa: tela.mapa, aoVivo: tela.aoVivo, replay: tela.replay })}
        aoVoltar={() => setTela({ nome: "selecao" })}
      />
    );

  const janelaDeConfiguracoes = <JanelaDeConfiguracoesMania aberta={configurando} aoFechar={() => setConfigurando(false)} opcoes={opcoes} aoMudar={mudarOpcoes} />;

  if (tela.nome === "menu")
    return (
      <main data-parte={PARTE_DA_TELA_DO_MODO} className={cn("relative flex h-dvh w-screen flex-col overflow-hidden text-texto", !palco && "bg-fundo")}>
        {!palco && <FundoDoMania />}
        {cabecalho}
        <div className="relative min-h-0 flex-1">
          <MenuDoMania
            alavanca={alavanca}
            troca={palco?.troca}
            aoJogar={() => setTela({ nome: "selecao" })}
            aoBuscar={() => setTela({ nome: "busca" })}
            aoConfigurar={() => setConfigurando(true)}
            aoLeaderboard={contasLigadas ? () => setTela({ nome: "leaderboard" }) : undefined}
            aoOnline={presencaDisponivel && contasLigadas ? () => setTela({ nome: "online" }) : undefined}
            chat={
              presencaDisponivel && contasLigadas && preferencias.chatGlobal !== false ? (
                <ChatGlobal className="w-full" aceito={preferencias.chatGlobal} aoResponder={responderAoChat} />
              ) : undefined
            }
          />
          {painelDeAmigos}
        </div>
        {janelaDeConfiguracoes}
        <Avisos />
      </main>
    );

  const nomeNaBiblioteca = (beatmapId: number) => {
    for (const c of conjuntos ?? []) {
      const mapa = c.mapas.find((m) => m.beatmapId === beatmapId);
      if (mapa) return `${c.tituloUnicode || c.titulo} [${mapa.dificuldade}]`;
    }
    return undefined;
  };

  if (tela.nome === "espectador")
    return (
      <main className="relative flex h-dvh w-screen flex-col overflow-hidden bg-fundo text-texto">
        <TelaDeEspectadorMania
          pessoa={tela.pessoa}
          conjuntos={conjuntos ?? []}
          carregarMapa={carregarMapa}
          opcoes={opcoes}
          decodificar={decodificar}
          aoSair={() => setTela({ nome: "online" })}
          aoBuscarMapas={() => setTela({ nome: "busca" })}
        />
        <Avisos />
      </main>
    );

  if (tela.nome === "leaderboard" || tela.nome === "perfil" || tela.nome === "online")
    return (
      <main className="relative flex h-dvh w-screen flex-col overflow-hidden bg-fundo text-texto">
        <FundoDoMania />
        {cabecalho}
        <div className="relative min-h-0 flex-1">
          {tela.nome === "online" ? (
            <TelaOnline
              logado={!!conta}
              euId={conta?.id ?? null}
              amigos={idsDosAmigos}
              presenca={estadoDaPresenca}
              mostrarOnline={preferencias.mostrarOnline}
              permitirEspectadores={preferencias.permitirEspectadores}
              aoMudar={mudarPreferencias}
              aoAssistir={assistir}
              aoVoltar={() => setTela({ nome: "menu" })}
            />
          ) : tela.nome === "leaderboard" ? (
            <TelaDeLeaderboard
              aoVoltar={() => setTela({ nome: "menu" })}
              tituloDaMusica={() => undefined}
              rotuloDasMusicas="Mapas"
              abaDasMusicas={<AbaDosMapasMaisJogados nomeNaBiblioteca={nomeNaBiblioteca} />}
            />
          ) : tela.nome === "perfil" && tela.amigo ? (
            <PerfilDoAmigo contaId={tela.amigo} aoVoltar={() => setTela({ nome: "menu" })} tituloDaMusica={() => undefined} />
          ) : (
            <TelaDePerfil mod={souDaModeracao} aoVoltar={() => setTela({ nome: "menu" })} tituloDaMusica={() => undefined} estatisticas={<EstatisticasDoMania />} />
          )}
          {painelDeAmigos}
        </div>
        {janelaDeConfiguracoes}
        <Avisos />
      </main>
    );

  return (
    <main className="relative flex h-dvh w-screen flex-col overflow-hidden bg-fundo text-texto">
      {/* Na seleção o fundo é a capa do mapa, borrada, que a própria tela desenha. */}
      {tela.nome !== "selecao" && <FundoDoMania />}
      {cabecalho}
      <div className="relative min-h-0 flex-1">
        {tela.nome === "busca" ? (
          <TelaDeBuscaMania aoVoltar={() => setTela({ nome: tela.veioDaSelecao ? "selecao" : "menu" })} baixados={baixados} aoBaixar={aoBaixar} aoJogar={(beatmapsetId) => setTela({ nome: "selecao", conjuntoId: `osu:${beatmapsetId}` })} buscar={buscar} baixar={baixar} />
        ) : (
          <TelaDeSelecaoMania selecionado={tela.nome === "selecao" ? tela.conjuntoId : undefined} aoVoltar={() => setTela({ nome: "menu" })} aoBuscarMapas={() => setTela({ nome: "busca", veioDaSelecao: true })} sortearMapa={sortearMapaNovo} conjuntos={conjuntos} mods={mods} aoMudarMods={setMods} aoImportar={aoImportar} aoJogar={aoJogar} aoTreinar={(conjunto, dificuldade) => void aoJogar(conjunto, dificuldade, true)} aoAssistir={(conjunto, dificuldade, linha) => void aoAssistir(conjunto, dificuldade, linha)} />
        )}
        {painelDeAmigos}
      </div>
      {janelaDeConfiguracoes}
      <Avisos />
    </main>
  );
}
