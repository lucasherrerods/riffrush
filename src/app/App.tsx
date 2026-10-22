import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TelaDePersonagem, carregarPersonagem, salvarPersonagem, type Personagem } from "@/modules/character";
import { ROTULOS_DOS_TRASTES, ROTULO_DA_ESTRELA, iniciarControle } from "@/modules/gamepad";
import { TelaDeJogo, type Resultado } from "@/modules/gameplay";
import { TelaDeSelecao } from "@/modules/library";
import { Fundo, MenuPrincipal } from "@/modules/menu";
import { definirTelaCheia, estaEmTelaCheia } from "@/modules/platform";
import { Adversarios, Placar, TelaDeMultijogador, ehClienteWebDaSala, enviarEstado, resolverMusica, useConexao, voltarParaASala } from "@/modules/multiplayer";
import { TelaDeResultado, salvarRecorde } from "@/modules/results";
import { TelaDeConfiguracoes, carregarConfiguracoes, salvarConfiguracoes, type Configuracoes } from "@/modules/settings";
import { MUSICAS_EMBUTIDAS, importarArquivo, type Dificuldade, type Musica } from "@/modules/songs";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { useTelaEstreita } from "@/shared/hooks/useTelaEstreita";
import { Avisos, avisar } from "@/shared/ui/avisos";
import { opcoesDaPartida } from "./opcoes";

type Tela = "menu" | "selecao" | "configuracoes" | "personagem" | "multijogador" | "jogo" | "resultado";

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
  const [partida, setPartida] = useState(0);
  const [emRede, setEmRede] = useState<PartidaEmRede | null>(null);
  const [voltarDoPersonagemPara, setVoltarDoPersonagemPara] = useState<Tela>("menu");
  const conexao = useConexao();
  const estreita = useTelaEstreita();
  const partidasVistas = useRef(0);

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

  const mudarConfiguracoes = (novas: Configuracoes) => {
    setConfiguracoes(novas);
    salvarConfiguracoes(novas);
  };

  const jogar = () => {
    setEmRede(null);
    setPartida((p) => p + 1);
    setTela("jogo");
  };

  const terminar = useCallback(
    (r: Resultado) => {
      // Com o bot tocando, o recorde não é do jogador.
      setResultado({ resultado: r, recordeNovo: !configuracoes.bot && salvarRecorde(r) });
      setTela("resultado");
    },
    [configuracoes.bot],
  );

  const importar = async (arquivos: File[]) => {
    const tentativas = await Promise.allSettled(arquivos.map(importarArquivo));
    const importadas = tentativas.flatMap((t) => (t.status === "fulfilled" ? [t.value] : []));
    for (const t of tentativas) if (t.status === "rejected") avisar.error(String(t.reason));
    if (!importadas.length) return;
    setMusicas((atuais) => {
      const novas = importadas.filter((m) => !atuais.some((a) => a.id === m.id));
      const todas = [...atuais, ...novas];
      setIndice(todas.findIndex((m) => m.id === importadas[importadas.length - 1].id));
      return todas;
    });
    const comChart = importadas.every((m) => m.sng);
    avisar.success(
      `${importadas.length} ${importadas.length === 1 ? "música importada" : "músicas importadas"}! ` +
        (comChart ? "Usando o chart do Clone Hero." : "O chart é gerado automaticamente."),
    );
  };

  return (
    <main className="dark relative h-dvh w-screen overflow-hidden bg-fundo text-texto">
      <Fundo tocando={tela === "jogo"} />
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
            />
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
                emRede && conexao.sala ? (
                  <Placar sala={conexao.sala} meusPontos={resultado.resultado.pontos} minhaDerrota={resultado.resultado.derrota} />
                ) : undefined
              }
            />
          )}
        </motion.div>
      </AnimatePresence>
      <Avisos />
    </main>
  );
}
