import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IndicadorDeVolume, definirVolumeGeral, useVolumeGeral } from "@/modules/audio";
import { TelaDePersonagem, carregarPersonagem, salvarPersonagem, type Personagem } from "@/modules/character";
import { iniciarControle, nomeDoBotao, useControleConectado } from "@/modules/gamepad";
import { TelaDeJogo, type Resultado, desempacotarReplay, type Replay } from "@/modules/gameplay";
import { ProgressoDaImportacao, SoltarParaImportar, TelaDeSelecao, juntarMusicas, semAudio, useBiblioteca, useImportacao } from "@/modules/library";
import { Fundo, MenuPrincipal } from "@/modules/menu";
import { CartaoDaConta, ExcluirConta, GanhoDeXp, TelaDePerfil, contasLigadas, sessaoDaConta, useConta, type XpDaPartida } from "@/modules/conta";
import { CabecalhoDoPlayerDeMusica, indiceVizinho, playerDeMusica, useSeguirMusica } from "@/modules/player";
import { definirTelaCheia, estaEmTelaCheia } from "@/modules/platform";
import { TelaDeDocumento, documentoDoEndereco } from "@/modules/legal";
import { Adversarios, Placar, TelaDeMultijogador, type PersonagemNaSala, ehClienteWebDaSala, enviarEstado, escolherNaSala, podeTocarOnline, resolverMusica, useConexao, voltarParaASala } from "@/modules/multiplayer";
import { ChatGlobal, TelaDeEspectador, TelaOnline, presenca, presencaDisponivel, transmitirPartida, usePresenca, type PessoaOnline } from "@/modules/presenca";
import { TelaDeBuscaDeMusicas, baixarDoEncore, baixarSng, montarUrlDoChart, type OpcoesDeBaixar, type ResultadoDaBusca } from "@/modules/search";
import { TelaDeResultado, carregarRecordes, recordeDe, salvarRecorde } from "@/modules/results";
import { TelaDeConfiguracoes, carregarConfiguracoes, salvarConfiguracoes, type Configuracoes } from "@/modules/settings";
import { MUSICAS_EMBUTIDAS, dificuldadeMaisProxima, dificuldadesDaMusica, idDoRanking, instrumentoDaMusica, tituloDaMusica, type Dificuldade, type Instrumento, type Musica } from "@/modules/songs";
import { PainelDeRanking, PlacarAoVivo, TelaDeLeaderboard, TelaDePartidaDoRanking } from "@/modules/ranking";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { useTelaEstreita } from "@/shared/hooks/useTelaEstreita";
import { Avisos, avisar } from "@/shared/ui/avisos";
import { opcoesDaPartida } from "./opcoes";

type Tela = "privacidade" | "termos" | "menu" | "selecao" | "configuracoes" | "personagem" | "multijogador" | "buscaDeMusicas" | "jogo" | "resultado" | "perfil" | "leaderboard" | "partidaDoRanking" | "online" | "espectador";

interface PartidaEmRede {
  musica: Musica;
  dificuldade: Dificuldade;
  instrumento: Instrumento;
  inicio: number;
}

export function App() {
  const [tela, setTela] = useState<Tela>(() => documentoDoEndereco(location.pathname) ?? "menu");
  const [configuracoes, setConfiguracoes] = useState<Configuracoes>(() => {
    const salvas = carregarConfiguracoes();
    // O volume geral vive no módulo de áudio; ao abrir, ele começa no que estava salvo.
    definirVolumeGeral(salvas.volumeGeral);
    return salvas;
  });
  const [personagem, setPersonagem] = useState<Personagem>(carregarPersonagem);
  const [musicas, setMusicas] = useState<Musica[]>(MUSICAS_EMBUTIDAS);
  const [indice, setIndice] = useState(0);
  const [dificuldade, setDificuldade] = useState<Dificuldade>("medio");
  const [instrumento, setInstrumento] = useState<Instrumento>("guitarra");
  const [partidaAberta, setPartidaAberta] = useState<string | null>(null);
  const [assistindo, setAssistindo] = useState<{ replay: Replay; dificuldade: Dificuldade; instrumento: Instrumento } | null>(null);
  const [resultado, setResultado] = useState<{ resultado: Resultado; recordeNovo: boolean } | null>(null);
  const [xpDaPartida, setXpDaPartida] = useState<XpDaPartida | null>(null);
  const [partida, setPartida] = useState(0);
  const [emRede, setEmRede] = useState<PartidaEmRede | null>(null);
  const [voltarDoPersonagemPara, setVoltarDoPersonagemPara] = useState<Tela>("menu");
  const [voltarDoPerfilPara, setVoltarDoPerfilPara] = useState<Tela>("menu");
  const [voltarDaBuscaPara, setVoltarDaBuscaPara] = useState<Tela>("menu");
  const [espectando, setEspectando] = useState<PessoaOnline | null>(null);
  const { conta } = useConta();
  /** Com a conta conectada, o nome é o do Google em todo lugar, e o nível vai junto para o lobby. */
  const personagemEmJogo = useMemo<PersonagemNaSala>(
    () => (conta ? { ...personagem, nome: conta.nome.trim().slice(0, 16) || personagem.nome, nivel: conta.nivel.nivel } : personagem),
    [personagem, conta],
  );
  const estadoDaPresenca = usePresenca();
  const conexao = useConexao();
  const estreita = useTelaEstreita();
  const partidasVistas = useRef(0);

  const biblioteca = useBiblioteca();
  const { salvas } = biblioteca;
  // As músicas de outras sessões chegam depois de abrir o armazenamento.
  useEffect(() => {
    if (salvas?.length) setMusicas((atuais) => juntarMusicas(atuais, salvas));
  }, [salvas]);

  const musica = emRede?.musica ?? musicas[indice];
  // Lida no fim da partida sem entrar nas dependências do terminar, que reiniciariam a partida.
  const musicaDaPartida = useRef(musica);
  musicaDaPartida.current = musica;
  // O instrumento e a dificuldade escolhidos ficam guardados; a música que não os tem usa o mais próximo do chart dela.
  const instrumentoDaSelecao = instrumentoDaMusica(musicas[indice] ?? {}, instrumento);
  const dificuldades = dificuldadesDaMusica(musicas[indice] ?? {}, instrumentoDaSelecao).map((d) => d.id);
  const dificuldadeDaSelecao = dificuldadeMaisProxima(dificuldades, dificuldade) ?? dificuldade;
  const dificuldadeDaPartida = assistindo?.dificuldade ?? emRede?.dificuldade ?? dificuldadeDaSelecao;
  const instrumentoDaPartida = assistindo?.instrumento ?? emRede?.instrumento ?? instrumentoDaSelecao;
  const comControle = useControleConectado();
  const opcoes = useMemo(() => {
    const base = opcoesDaPartida(configuracoes);
    if (!comControle) return base;
    return { ...base, rotulosDosTrastes: configuracoes.botoesDoControle.map(nomeDoBotao), rotuloDaTeclaDaEstrela: nomeDoBotao(configuracoes.botaoDaEstrela) };
  }, [configuracoes, comControle]);

  useTeclado((evento) => {
    if (evento.code !== "Tab" || !evento.shiftKey) return;
    // Sem o preventDefault, o navegador também pularia o foco para o botão anterior.
    evento.preventDefault();
    const modoCompetitivo = !configuracoes.modoCompetitivo;
    mudarConfiguracoes({ ...configuracoes, modoCompetitivo });
    avisar(modoCompetitivo ? "Modo competitivo ligado" : "Modo competitivo desligado");
  });

  useTeclado(async (evento) => {
    if (evento.code !== "F11") return;
    evento.preventDefault();
    await definirTelaCheia(!(await estaEmTelaCheia()));
  });

  const telaAtual = useRef(tela);
  telaAtual.current = tela;
  const configuracoesAtuais = useRef(configuracoes);
  configuracoesAtuais.current = configuracoes;
  useEffect(() => {
    const aoConectar = () => {
      const { botoesDoControle } = configuracoesAtuais.current;
      avisar(`Controle conectado! Trastes: ${botoesDoControle.map(nomeDoBotao).join(" ")}`);
    };
    window.addEventListener("gamepadconnected", aoConectar);
    const parar = iniciarControle({
      modo: () => (telaAtual.current === "jogo" ? "jogo" : "menu"),
      mapa: () => configuracoesAtuais.current,
    });
    return () => {
      parar();
      window.removeEventListener("gamepadconnected", aoConectar);
    };
  }, []);

  // O host deu a largada: acha a música (baixando do host se for importada) e entra na partida.
  useEffect(() => {
    const sala = conexao.sala;
    if (!sala || sala.partidas === partidasVistas.current) return;
    partidasVistas.current = sala.partidas;
    resolverMusica(sala.musica, musicas, conexao.endereco)
      .then((m) => {
        setEmRede({ musica: m, dificuldade: sala.dificuldade, instrumento: sala.instrumento, inicio: sala.inicio });
        setPartida((p) => p + 1);
        setTela("jogo");
      })
      .catch((erro) => avisar.error(String(erro)));
  }, [conexao, musicas]);

  // A sala acabou no meio da partida.
  useEffect(() => {
    if (conexao.sala || !emRede) return;
    setEmRede(null);
    if (conexao.erro) avisar.error(conexao.erro);
    setTela("multijogador");
  }, [conexao, emRede]);

  // O player toca a biblioteca desde a abertura, menos as músicas que perderam o áudio.
  const filaDoPlayer = useMemo(() => musicas.filter((m) => !semAudio(m)), [musicas]);
  useEffect(() => {
    playerDeMusica.definirFila(filaDoPlayer);
    if (!playerDeMusica.estado().musica && filaDoPlayer[0]) playerDeMusica.seguir(filaDoPlayer[0]);
  }, [filaDoPlayer]);
  useEffect(() => {
    playerDeMusica.definirVolume(configuracoes.volumeDoPlayer);
  }, [configuracoes.volumeDoPlayer]);
  // O atalho muda o volume de qualquer tela, direto no módulo de áudio; aqui ele só é guardado nas configurações.
  const { volume: volumeGeral } = useVolumeGeral();
  useEffect(() => {
    setConfiguracoes((atuais) => {
      if (atuais.volumeGeral === volumeGeral) return atuais;
      const novas = { ...atuais, volumeGeral };
      salvarConfiguracoes(novas);
      return novas;
    });
  }, [volumeGeral]);
  // Assistir ao vivo também é uma partida na tela: sem o player do menu e sem o cabeçalho.
  const naPista = tela === "jogo" || tela === "espectador";
  useEffect(() => {
    playerDeMusica.suspender(naPista);
  }, [naPista]);

  // Só aparece online quem aceitou, com conta e com o relay configurado.
  const online = presencaDisponivel && contasLigadas && !!conta && configuracoes.mostrarOnline === true;
  useEffect(() => {
    if (online) presenca.ligar();
    else presenca.desligar();
  }, [online]);
  // A partida só vai ao ar quando dá para quem assiste ter a mesma música: as do jogo e as do Encore.
  const transmitindo = online && configuracoes.permitirEspectadores && tela === "jogo" && !emRede && !assistindo && !configuracoes.bot && podeTocarOnline(musica);
  useEffect(() => {
    presenca.definirEstado(
      tela === "jogo" && !assistindo
        ? {
            tipo: "tocando",
            musica: idDoRanking(musica),
            titulo: musica.titulo,
            artista: musica.artista,
            dificuldade: dificuldadeDaPartida,
            instrumento: instrumentoDaPartida,
            transmitindo,
          }
        : { tipo: "menu" },
    );
  }, [tela, assistindo, musica, dificuldadeDaPartida, instrumentoDaPartida, transmitindo]);
  /** Quantas pessoas estão assistindo a partida transmitida agora. */
  const [espectadores, setEspectadores] = useState(0);
  // Uma transmissão por partida: recomeçar a música dentro dela manda um início novo pela mesma.
  const transmissao = useMemo(
    () =>
      transmitindo && conta
        ? transmitirPartida(
            {
              contaId: conta.id,
              musica: idDoRanking(musica),
              dificuldade: dificuldadeDaPartida,
              instrumento: instrumentoDaPartida,
              urlDoEncore: musica.urlDoEncore,
            },
            setEspectadores,
          )
        : undefined,
    // A partida (contador) entra para uma partida nova ganhar uma transmissão nova.
    [transmitindo, conta?.id, partida],
  );
  // Na seleção o player toca a música escolhida, e avançar/voltar mexem no carrossel.
  const escolhida = musicas[indice];
  useSeguirMusica(tela === "selecao" && escolhida && !semAudio(escolhida) ? escolhida : null);
  useEffect(() => {
    if (tela !== "selecao") return;
    playerDeMusica.definirNavegacao((passos) => setIndice((i) => indiceVizinho(musicas.length, i, passos)));
    return () => playerDeMusica.definirNavegacao(null);
  }, [tela, musicas.length]);

  // Termina o login que voltou do Google ou retoma a sessão guardada.
  useEffect(() => {
    if (contasLigadas) sessaoDaConta.iniciar().catch((erro) => avisar.error(erro instanceof Error ? erro.message : String(erro)));
  }, []);

  const mudarConfiguracoes = (novas: Configuracoes) => {
    // O slider das configurações também passa pelo módulo de áudio, a única fonte do volume geral.
    if (novas.volumeGeral !== volumeGeral) definirVolumeGeral(novas.volumeGeral);
    setConfiguracoes(novas);
    salvarConfiguracoes(novas);
  };

  const jogar = async () => {
    const escolhida = musicas[indice];
    void biblioteca.usar(escolhida.id);
    const pronta = await biblioteca.prepararParaTocar(escolhida);
    if (pronta !== escolhida) setMusicas((atuais) => juntarMusicas(atuais, [pronta]));
    setEmRede(null);
    setAssistindo(null);
    setPartida((p) => p + 1);
    setTela("jogo");
  };

  const assistirReplay = async (bytes: Uint8Array, dificuldadeDoReplay: Dificuldade, instrumentoDoReplay: Instrumento) => {
    const replay = await desempacotarReplay(bytes).catch(() => null);
    if (!replay) return avisar.error("Este replay é de uma versão do jogo que este app não abre.");
    const pronta = await biblioteca.prepararParaTocar(musicas[indice]);
    if (pronta !== musicas[indice]) setMusicas((atuais) => juntarMusicas(atuais, [pronta]));
    setEmRede(null);
    setAssistindo({ replay, dificuldade: dificuldadeDoReplay, instrumento: instrumentoDoReplay });
    setPartida((p) => p + 1);
    setTela("jogo");
  };

  const sairDoReplay = useCallback(() => {
    setAssistindo(null);
    setTela("partidaDoRanking");
  }, []);

  const terminar = useCallback(
    (r: Resultado, gerarReplay?: () => Promise<Uint8Array>) => {
      // Com o bot tocando, o recorde não é do jogador.
      setResultado({ resultado: r, recordeNovo: !configuracoes.bot && salvarRecorde(r) });
      setXpDaPartida(null);
      if (!configuracoes.bot) {
        // Sem o replay a partida ainda vale: só não dá para assistir depois.
        (gerarReplay ? gerarReplay().catch(() => undefined) : Promise.resolve(undefined))
          .then((replay) => sessaoDaConta.registrarPartida({ ...r, musicaId: idDoRanking(musicaDaPartida.current) }, replay))
          .then(setXpDaPartida)
          .catch((erro) => avisar.error(`Não deu para registrar o XP: ${erro instanceof Error ? erro.message : String(erro)}`));
      }
      setTela("resultado");
    },
    [configuracoes.bot],
  );

  const { importar, progresso } = useImportacao((importadas) => {
    setMusicas((atuais) => {
      const todas = juntarMusicas(atuais, importadas);
      setIndice(todas.findIndex((m) => m.id === importadas[importadas.length - 1].id));
      return todas;
    });
    void biblioteca.guardar(importadas);
    // Arrastou no menu: já mostra a música na seleção.
    if (telaAtual.current === "menu") setTela("selecao");
  });

  // Música do Encore que perdeu o áudio (o navegador apagou) volta a mostrar "Baixar".
  const baixadasDoEncore = useMemo(() => new Set(musicas.flatMap((m) => (m.md5DoEncore && !semAudio(m) ? [m.md5DoEncore] : []))), [musicas]);

  const baixarMusica = async (resultado: ResultadoDaBusca, opcoes: OpcoesDeBaixar) => {
    const arquivo = await baixarDoEncore(resultado, opcoes);
    if (!arquivo) return false;
    await importar([arquivo], { md5DoEncore: resultado.md5, urlDoEncore: montarUrlDoChart(resultado, { comVideo: opcoes.comVideo }) });
    return true;
  };

  /** Quem assiste baixa o chart que a transmissão mandou. Arquivo grande demais (com vídeo) fica para a busca, onde dá para escolher. */
  const baixarParaAssistir = async (url: string, md5: string) => {
    const nome = espectando?.estado.tipo === "tocando" ? `${espectando.estado.artista} - ${espectando.estado.titulo}.sng` : `${md5}.sng`;
    const arquivo = await baixarSng(url, nome, { confirmarTamanho: async () => false });
    if (!arquivo) throw new Error("Esse chart é grande demais para baixar aqui. Baixe pela busca de músicas.");
    await importar([arquivo], { md5DoEncore: md5, urlDoEncore: url });
  };

  const jogarBaixada = (md5: string) => {
    const posicao = musicas.findIndex((m) => m.md5DoEncore === md5);
    // Veio do lobby: volta para a sala, e o host já deixa a música escolhida para todos.
    if (voltarDaBuscaPara === "multijogador") {
      const sala = conexao.sala;
      if (posicao >= 0 && sala?.souHost) escolherNaSala(musicas[posicao], sala.dificuldade).catch((erro) => avisar.error(erro instanceof Error ? erro.message : String(erro)));
      return setTela("multijogador");
    }
    if (posicao >= 0) setIndice(posicao);
    setTela("selecao");
  };

  return (
    <main className="dark relative flex h-dvh w-screen flex-col overflow-hidden bg-fundo text-texto">
      {!(naPista && configuracoes.modoCompetitivo) && <Fundo tocando={naPista} />}
      {!naPista && (
        <CabecalhoDoPlayerDeMusica volume={volumeGeral} aoMudarVolume={definirVolumeGeral}>
          {contasLigadas && (
            <CartaoDaConta
              aoVerPerfil={() => {
                if (tela === "perfil") return;
                setVoltarDoPerfilPara(tela);
                setTela("perfil");
              }}
            />
          )}
        </CabecalhoDoPlayerDeMusica>
      )}
      <div className="relative flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={tela === "jogo" ? `jogo-${partida}` : tela}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0"
          >
            {tela === "menu" && (
              <MenuPrincipal
                volumeDosEfeitos={configuracoes.volumeDosEfeitos}
                noCelular={ehClienteWebDaSala()}
                aoJogar={() => setTela("selecao")}
                aoMultijogador={() => setTela("multijogador")}
                aoPersonagem={() => {
                  setVoltarDoPersonagemPara("menu");
                  setTela("personagem");
                }}
                aoConfigurar={() => setTela("configuracoes")}
                aoLeaderboard={contasLigadas ? () => setTela("leaderboard") : undefined}
                aoOnline={presencaDisponivel && contasLigadas ? () => setTela("online") : undefined}
                chat={
                  presencaDisponivel && contasLigadas && configuracoes.chatGlobal !== false && !ehClienteWebDaSala() ? (
                    <ChatGlobal className="w-full" aceito={configuracoes.chatGlobal} aoResponder={(chatGlobal) => mudarConfiguracoes({ ...configuracoes, chatGlobal })} />
                  ) : undefined
                }
                aoBuscarMusicas={() => {
                  setVoltarDaBuscaPara("menu");
                  setTela("buscaDeMusicas");
                }}
                aoAbrirDocumento={setTela}
              />
            )}
            {(tela === "privacidade" || tela === "termos") && (
              <TelaDeDocumento
                documento={tela}
                aoVoltar={() => {
                  // Quem chegou pelo link direto volta para o endereço do jogo.
                  if (documentoDoEndereco(location.pathname)) history.replaceState(null, "", "/");
                  setTela("menu");
                }}
              >
                {tela === "privacidade" && contasLigadas && <ExcluirConta />}
              </TelaDeDocumento>
            )}
            {tela === "selecao" && (
              <TelaDeSelecao
                musicas={musicas}
                indice={indice}
                dificuldade={dificuldadeDaSelecao}
                instrumento={instrumentoDaSelecao}
                personagem={personagemEmJogo}
                volumeDosEfeitos={configuracoes.volumeDosEfeitos}
                aoSelecionar={setIndice}
                aoDificuldade={setDificuldade}
                aoInstrumento={setInstrumento}
                aoJogar={jogar}
                aoVoltar={() => setTela("menu")}
                aoImportar={(arquivos) => void importar(arquivos)}
                aoRemover={(removida) => {
                  void biblioteca.remover(removida);
                  setMusicas((atuais) => {
                    const restantes = atuais.filter((m) => m.id !== removida.id);
                    setIndice((i) => Math.min(i, restantes.length - 1));
                    return restantes;
                  });
                  avisar.success(`${removida.titulo} removida.`);
                }}
                ranking={contasLigadas && escolhida ? (
                    <PainelDeRanking
                      musicaId={idDoRanking(escolhida)}
                      dificuldade={dificuldadeDaSelecao}
                      instrumento={instrumentoDaSelecao}
                      aoAbrirPartida={(id) => {
                        setPartidaAberta(id);
                        setTela("partidaDoRanking");
                      }}
                    />
                  ) : undefined}
              />
            )}
            {tela === "partidaDoRanking" && escolhida && partidaAberta && (
              <TelaDePartidaDoRanking
                partidaId={partidaAberta}
                titulo={escolhida.titulo}
                artista={escolhida.artista}
                aoVoltar={() => setTela("selecao")}
                aoAssistir={(bytes, partidaDoReplay) => void assistirReplay(bytes, partidaDoReplay.dificuldade, partidaDoReplay.instrumento)}
              />
            )}
            {tela === "buscaDeMusicas" && (
              <TelaDeBuscaDeMusicas aoVoltar={() => setTela(voltarDaBuscaPara)} aoBaixar={baixarMusica} baixadas={baixadasDoEncore} aoJogar={jogarBaixada} />
            )}
            {tela === "online" && (
              <TelaOnline
                logado={!!conta}
                euId={conta?.id ?? null}
                presenca={estadoDaPresenca}
                mostrarOnline={configuracoes.mostrarOnline}
                permitirEspectadores={configuracoes.permitirEspectadores}
                aoMudar={(preferencias) => mudarConfiguracoes({ ...configuracoes, ...preferencias })}
                aoAssistir={(pessoa) => {
                  setEspectando(pessoa);
                  setTela("espectador");
                }}
                aoVoltar={() => setTela("menu")}
              />
            )}
            {tela === "espectador" && espectando && (
              <TelaDeEspectador
                pessoa={espectando}
                musicas={musicas}
                opcoes={opcoes}
                personagem={personagemEmJogo}
                aoSair={() => setTela("online")}
                aoBuscarMusicas={() => {
                  setVoltarDaBuscaPara("online");
                  setTela("buscaDeMusicas");
                }}
                aoBaixar={baixarParaAssistir}
              />
            )}
            {tela === "leaderboard" && <TelaDeLeaderboard aoVoltar={() => setTela("menu")} tituloDaMusica={(id) => tituloDaMusica(musicas, id)} />}
            {tela === "perfil" && (
              <TelaDePerfil aoVoltar={() => setTela(voltarDoPerfilPara)} tituloDaMusica={(id) => tituloDaMusica(musicas, id)} />
            )}
            {tela === "configuracoes" && (
              <TelaDeConfiguracoes configuracoes={configuracoes} aoMudar={mudarConfiguracoes} aoVoltar={() => setTela("menu")} />
            )}
            {tela === "personagem" && (
              <TelaDePersonagem
                personagem={personagem}
                nomeDaConta={conta?.nome.trim().slice(0, 16) || undefined}
                aoVoltar={() => setTela(voltarDoPersonagemPara)}
                aoSalvar={(novo) => {
                  setPersonagem(novo);
                  salvarPersonagem(novo);
                  avisar.success("Personagem salvo!");
                  setTela(voltarDoPersonagemPara);
                }}
              />
            )}
            {tela === "multijogador" && (
              <TelaDeMultijogador
                personagem={personagemEmJogo}
                musicas={musicas}
                volumeDosEfeitos={configuracoes.volumeDosEfeitos}
                aoVoltar={() => setTela("menu")}
                aoEditarPersonagem={() => {
                  setVoltarDoPersonagemPara("multijogador");
                  setTela("personagem");
                }}
                aoBuscarMusicas={() => {
                  setVoltarDaBuscaPara("multijogador");
                  setTela("buscaDeMusicas");
                }}
              />
            )}
            {tela === "jogo" && (
              <TelaDeJogo
                musica={musica}
                dificuldade={dificuldadeDaPartida}
                instrumento={instrumentoDaPartida}
                opcoes={opcoes}
                personagem={personagemEmJogo}
                recorde={assistindo ? undefined : recordeDe(carregarRecordes(), musica.id, dificuldadeDaPartida, instrumentoDaPartida)?.pontos}
                replay={assistindo?.replay}
                rede={
                  emRede && conexao.sala
                    ? { inicio: emRede.inicio, aoAtualizar: enviarEstado, adversarios: <Adversarios sala={conexao.sala} compacto={estreita} /> }
                    : undefined
                }
                // Em rede o canto mostra a sala; sozinho, o ranking global da música.
                placar={contasLigadas && !emRede && !assistindo ? (pontos) => <PlacarAoVivo musicaId={idDoRanking(musica)} dificuldade={dificuldadeDaPartida} instrumento={instrumentoDaPartida} pontos={pontos} /> : undefined}
                aoSair={assistindo ? sairDoReplay : () => setTela(emRede ? "multijogador" : "selecao")}
                aoTerminar={assistindo ? sairDoReplay : terminar}
                transmissao={transmissao}
                espectadores={transmissao ? espectadores : 0}
              />
            )}
            {tela === "resultado" && resultado && (
              <TelaDeResultado
                titulo={musica.titulo}
                artista={musica.artista}
                resultado={resultado.resultado}
                recordeNovo={resultado.recordeNovo}
                volumeDosEfeitos={configuracoes.volumeDosEfeitos}
                aoRepetir={jogar}
                aoContinuar={() => {
                  if (!emRede) return setTela("selecao");
                  setEmRede(null);
                  voltarParaASala();
                  setTela("multijogador");
                }}
                rotuloDeContinuar={emRede ? "Voltar para a sala" : undefined}
                extra={
                  <>
                    {xpDaPartida && <GanhoDeXp xp={xpDaPartida} />}
                    {emRede && conexao.sala && (
                      <Placar sala={conexao.sala} meusPontos={resultado.resultado.pontos} minhaDerrota={resultado.resultado.derrota} meuFantasma={resultado.resultado.fantasma} />
                    )}
                  </>
                }
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <IndicadorDeVolume />
      <SoltarParaImportar ativo={!naPista} aoSoltar={(arquivos) => void importar(arquivos)} />
      <ProgressoDaImportacao progresso={progresso} />
      <Avisos />
    </main>
  );
}
