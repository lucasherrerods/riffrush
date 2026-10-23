import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TelaDePersonagem, carregarPersonagem, salvarPersonagem, type Personagem } from "@/modules/character";
import { ROTULOS_DOS_TRASTES, ROTULO_DA_ESTRELA, iniciarControle } from "@/modules/gamepad";
import { TelaDeJogo, type Resultado } from "@/modules/gameplay";
import { ProgressoDaImportacao, SoltarParaImportar, TelaDeSelecao, juntarMusicas, semAudio, useBiblioteca, useImportacao } from "@/modules/library";
import { Fundo, MenuPrincipal } from "@/modules/menu";
import { CartaoDaConta, GanhoDeXp, contasLigadas, sessaoDaConta, type XpDaPartida } from "@/modules/conta";
import { CabecalhoDoPlayerDeMusica, indiceVizinho, playerDeMusica, useSeguirMusica } from "@/modules/player";
import { definirTelaCheia, estaEmTelaCheia } from "@/modules/platform";
import { Adversarios, Placar, TelaDeMultijogador, ehClienteWebDaSala, enviarEstado, resolverMusica, useConexao, voltarParaASala } from "@/modules/multiplayer";
import { TelaDeBuscaDeMusicas, baixarDoEncore, montarUrlDoChart, type OpcoesDeBaixar, type ResultadoDaBusca } from "@/modules/search";
import { TelaDeResultado, carregarRecordes, recordeDe, salvarRecorde } from "@/modules/results";
import { TelaDeConfiguracoes, carregarConfiguracoes, salvarConfiguracoes, type Configuracoes } from "@/modules/settings";
import { MUSICAS_EMBUTIDAS, type Dificuldade, type Musica } from "@/modules/songs";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { useTelaEstreita } from "@/shared/hooks/useTelaEstreita";
import { Avisos, avisar } from "@/shared/ui/avisos";
import { opcoesDaPartida } from "./opcoes";

type Tela = "menu" | "selecao" | "configuracoes" | "personagem" | "multijogador" | "buscaDeMusicas" | "jogo" | "resultado";

interface PartidaEmRede {
  musica: Musica;
  dificuldade: Dificuldade;
  inicio: number;
}

export function App() {
  const [tela, setTela] = useState<Tela>("menu");
  const [configuracoes, setConfiguracoes] = useState<Configuracoes>(carregarConfiguracoes);
  const [personagem, setPersonagem] = useState<Personagem>(carregarPersonagem);
  const [musicas, setMusicas] = useState<Musica[]>(MUSICAS_EMBUTIDAS);
  const [indice, setIndice] = useState(0);
  const [dificuldade, setDificuldade] = useState<Dificuldade>("medio");
  const [resultado, setResultado] = useState<{ resultado: Resultado; recordeNovo: boolean } | null>(null);
  const [xpDaPartida, setXpDaPartida] = useState<XpDaPartida | null>(null);
  const [partida, setPartida] = useState(0);
  const [emRede, setEmRede] = useState<PartidaEmRede | null>(null);
  const [voltarDoPersonagemPara, setVoltarDoPersonagemPara] = useState<Tela>("menu");
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
  const dificuldadeDaPartida = emRede?.dificuldade ?? dificuldade;
  const [comControle, setComControle] = useState(() => Array.from(navigator.getGamepads?.() ?? []).some((c) => c));
  const opcoes = useMemo(() => {
    const base = opcoesDaPartida(configuracoes);
    return comControle ? { ...base, rotulosDosTrastes: ROTULOS_DOS_TRASTES, rotuloDaTeclaDaEstrela: ROTULO_DA_ESTRELA } : base;
  }, [configuracoes, comControle]);

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
      setComControle(true);
      avisar(`Controle conectado! Trastes: ${ROTULOS_DOS_TRASTES.join(" ")}`);
    };
    const aoDesconectar = () => setComControle(Array.from(navigator.getGamepads?.() ?? []).some((c) => c));
    window.addEventListener("gamepadconnected", aoConectar);
    window.addEventListener("gamepaddisconnected", aoDesconectar);
    const parar = iniciarControle({
      modo: () => (telaAtual.current === "jogo" ? "jogo" : "menu"),
      mapa: () => configuracoesAtuais.current,
    });
    return () => {
      parar();
      window.removeEventListener("gamepadconnected", aoConectar);
      window.removeEventListener("gamepaddisconnected", aoDesconectar);
    };
  }, []);

  // O host deu a largada: acha a música (baixando do host se for importada) e entra na partida.
  useEffect(() => {
    const sala = conexao.sala;
    if (!sala || sala.partidas === partidasVistas.current) return;
    partidasVistas.current = sala.partidas;
    resolverMusica(sala.musica, musicas, conexao.endereco)
      .then((m) => {
        setEmRede({ musica: m, dificuldade: sala.dificuldade, inicio: sala.inicio });
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
  useEffect(() => playerDeMusica.definirVolume(configuracoes.volumeDaMusica), [configuracoes.volumeDaMusica]);
  useEffect(() => playerDeMusica.suspender(tela === "jogo"), [tela]);
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
    setConfiguracoes(novas);
    salvarConfiguracoes(novas);
  };

  const jogar = async () => {
    const escolhida = musicas[indice];
    void biblioteca.usar(escolhida.id);
    const pronta = await biblioteca.prepararParaTocar(escolhida);
    if (pronta !== escolhida) setMusicas((atuais) => juntarMusicas(atuais, [pronta]));
    setEmRede(null);
    setPartida((p) => p + 1);
    setTela("jogo");
  };

  const terminar = useCallback(
    (r: Resultado) => {
      // Com o bot tocando, o recorde não é do jogador.
      setResultado({ resultado: r, recordeNovo: !configuracoes.bot && salvarRecorde(r) });
      setXpDaPartida(null);
      if (!configuracoes.bot) {
        sessaoDaConta
          .registrarPartida(r)
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

  const jogarBaixada = (md5: string) => {
    const posicao = musicas.findIndex((m) => m.md5DoEncore === md5);
    if (posicao >= 0) setIndice(posicao);
    setTela("selecao");
  };

  return (
    <main className="dark relative flex h-dvh w-screen flex-col overflow-hidden bg-fundo text-texto">
      <Fundo tocando={tela === "jogo"} />
      {tela !== "jogo" && <CabecalhoDoPlayerDeMusica>{contasLigadas && <CartaoDaConta />}</CabecalhoDoPlayerDeMusica>}
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
                aoBuscarMusicas={() => setTela("buscaDeMusicas")}
              />
            )}
            {tela === "selecao" && (
              <TelaDeSelecao
                musicas={musicas}
                indice={indice}
                dificuldade={dificuldade}
                personagem={personagem}
                volumeDosEfeitos={configuracoes.volumeDosEfeitos}
                aoSelecionar={setIndice}
                aoDificuldade={setDificuldade}
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
              />
            )}
            {tela === "buscaDeMusicas" && (
              <TelaDeBuscaDeMusicas aoVoltar={() => setTela("menu")} aoBaixar={baixarMusica} baixadas={baixadasDoEncore} aoJogar={jogarBaixada} />
            )}
            {tela === "configuracoes" && (
              <TelaDeConfiguracoes configuracoes={configuracoes} aoMudar={mudarConfiguracoes} aoVoltar={() => setTela("menu")} />
            )}
            {tela === "personagem" && (
              <TelaDePersonagem
                personagem={personagem}
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
                personagem={personagem}
                musicas={musicas}
                volumeDosEfeitos={configuracoes.volumeDosEfeitos}
                aoVoltar={() => setTela("menu")}
                aoEditarPersonagem={() => {
                  setVoltarDoPersonagemPara("multijogador");
                  setTela("personagem");
                }}
              />
            )}
            {tela === "jogo" && (
              <TelaDeJogo
                musica={musica}
                dificuldade={dificuldadeDaPartida}
                opcoes={opcoes}
                personagem={personagem}
                recorde={recordeDe(carregarRecordes(), musica.id, dificuldadeDaPartida)?.pontos}
                rede={
                  emRede && conexao.sala
                    ? { inicio: emRede.inicio, aoAtualizar: enviarEstado, adversarios: <Adversarios sala={conexao.sala} compacto={estreita} /> }
                    : undefined
                }
                aoSair={() => setTela(emRede ? "multijogador" : "selecao")}
                aoTerminar={terminar}
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
      <SoltarParaImportar ativo={tela !== "jogo"} aoSoltar={(arquivos) => void importar(arquivos)} />
      <ProgressoDaImportacao progresso={progresso} />
      <Avisos />
    </main>
  );
}
