import { useEffect, useState } from "react";
import { ArrowLeft, Gamepad2, Keyboard, Monitor, RotateCcw, Volume2 } from "lucide-react";
import { capturarBotao, nomeDoBotao, useControleConectado } from "@/modules/gamepad";
import { CORES_DAS_PISTAS, COR_DA_ABERTA, COR_DA_ESTRELA, NOMES_DAS_PISTAS } from "@/modules/gameplay";
import { PISTA_ABERTA } from "@/modules/songs";
import { definirTelaCheia, estaEmTelaCheia } from "@/modules/platform";
import { QUALIDADES_DO_PALCO } from "@/modules/stage";
import { GrupoDeOpcoes } from "@/shared/ui/GrupoDeOpcoes";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Calibracao } from "./componentes/Calibracao";
import { LinhaDeOpcao } from "./componentes/LinhaDeOpcao";
import { LinhaDeSlider } from "./componentes/LinhaDeSlider";
import { CONFIGURACOES_PADRAO, INDICE_DA_ESTRELA, nomeDaTecla, trocarBotao, trocarTecla, type Configuracoes } from "./configuracoes";

interface Props {
  configuracoes: Configuracoes;
  aoMudar: (configuracoes: Configuracoes) => void;
  aoVoltar: () => void;
}

const porcentagem = (valor: number) => `${Math.round(valor * 100)}%`;

export function TelaDeConfiguracoes({ configuracoes, aoMudar, aoVoltar }: Props) {
  /** Qual tecla está esperando a nova: 0 a 4 são os trastes, 5 é o star power. */
  const [trocando, setTrocando] = useState<number | null>(null);
  /** Qual botão do controle está esperando o novo, com os mesmos índices. */
  const [trocandoNoControle, setTrocandoNoControle] = useState<number | null>(null);
  const comControle = useControleConectado();
  const [telaCheia, setTelaCheia] = useState(false);
  const mudar = (parcial: Partial<Configuracoes>) => aoMudar({ ...configuracoes, ...parcial });

  useEffect(() => {
    estaEmTelaCheia()
      .then(setTelaCheia)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (trocandoNoControle === null) return;
    return capturarBotao((botao) => {
      aoMudar(trocarBotao(configuracoes, trocandoNoControle, botao));
      setTrocandoNoControle(null);
    });
  }, [trocandoNoControle, configuracoes, aoMudar]);

  useTeclado((evento) => {
    if (trocandoNoControle !== null) {
      // Esc no teclado cancela; o controle está ocupado escolhendo o botão.
      if (evento.code === "Escape") setTrocandoNoControle(null);
      evento.preventDefault();
    } else if (trocando !== null) {
      evento.preventDefault();
      if (evento.code !== "Escape") aoMudar(trocarTecla(configuracoes, trocando, evento.code));
      setTrocando(null);
    } else if (evento.code === "Escape") {
      aoVoltar();
    }
  });

  const alternarTelaCheia = async (ligada: boolean) => {
    setTelaCheia(ligada);
    await definirTelaCheia(ligada).catch(() => setTelaCheia(!ligada));
  };

  const botaoDeTecla = (indice: number, nome: string, codigo: string, cor: string) => (
    <button
      aria-label={`Tecla ${nome}`}
      onClick={() => setTrocando(indice)}
      className="min-w-28 rounded-lg border-2 bg-superficie px-4 py-2 font-mono text-base font-bold transition-colors hover:bg-superficie-elevada/40"
      style={{ borderColor: trocando === indice ? "var(--cor-texto)" : cor }}
    >
      {trocando === indice ? "Aperte..." : nomeDaTecla(codigo)}
    </button>
  );

  const botaoDoControle = (indice: number, nome: string, botao: number, cor: string) => (
    <button
      aria-label={`Botão do controle ${nome}`}
      onClick={() => setTrocandoNoControle(trocandoNoControle === indice ? null : indice)}
      className="min-w-28 rounded-lg border-2 bg-superficie px-4 py-2 font-mono text-base font-bold transition-colors hover:bg-superficie-elevada/40"
      style={{ borderColor: trocandoNoControle === indice ? "var(--cor-texto)" : cor }}
    >
      {trocandoNoControle === indice ? "Aperte..." : nomeDoBotao(botao)}
    </button>
  );

  /** Com controle ligado, cada linha mostra a tecla e o botão do controle lado a lado. */
  const comandos = (indice: number, nome: string, codigo: string, botao: number, cor: string) => (
    <div className="flex gap-2">
      {botaoDeTecla(indice, nome, codigo, cor)}
      {comControle && botaoDoControle(indice, nome, botao, cor)}
    </div>
  );

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="text-4xl leading-[1.1] font-black tracking-[-0.02em]">Configurações</h1>
        <div className="flex-1" />
        <Button variant="ghost" onClick={() => aoMudar(CONFIGURACOES_PADRAO)}>
          <RotateCcw className="opacity-70" /> Restaurar padrão
        </Button>
      </header>

      <Tabs defaultValue="controles" className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <TabsList className="w-full">
          <TabsTrigger value="controles">
            <Keyboard className="opacity-70" /> Controles
          </TabsTrigger>
          <TabsTrigger value="gameplay">
            <Gamepad2 className="opacity-70" /> Gameplay
          </TabsTrigger>
          <TabsTrigger value="audio">
            <Volume2 className="opacity-70" /> Áudio
          </TabsTrigger>
          <TabsTrigger value="video">
            <Monitor className="opacity-70" /> Vídeo
          </TabsTrigger>
        </TabsList>

        <div className="mt-2 min-h-0 flex-1 placa p-2">
          <TabsContent value="controles" className="flex flex-col gap-2">
            <p className="px-4 py-2 text-base text-texto-suave">
              {comControle
                ? "Clique numa tecla ou num botão do controle e aperte o novo. Esc cancela. O direcional e o Start ficam fixos."
                : "Clique numa tecla e aperte a nova. Esc cancela. Conecte um controle e aperte um botão dele para trocar os botões também."}
            </p>
            {NOMES_DAS_PISTAS.map((nome, i) => (
              <LinhaDeOpcao key={nome} rotulo={`Traste ${nome}`}>
                {comandos(i, `do traste ${nome}`, configuracoes.teclas[i], configuracoes.botoesDoControle[i], CORES_DAS_PISTAS[i])}
              </LinhaDeOpcao>
            ))}
            <LinhaDeOpcao rotulo="Nota aberta" dica="A barra roxa que atravessa a pista: toque sem nenhum traste">
              {comandos(PISTA_ABERTA, "da nota aberta", configuracoes.teclas[PISTA_ABERTA], configuracoes.botoesDoControle[PISTA_ABERTA], COR_DA_ABERTA)}
            </LinhaDeOpcao>
            <LinhaDeOpcao rotulo="Star Power" dica="Ativa o bônus quando a barra passa da metade">
              {comandos(INDICE_DA_ESTRELA, "do star power", configuracoes.teclaDaEstrela, configuracoes.botaoDaEstrela, COR_DA_ESTRELA)}
            </LinhaDeOpcao>
          </TabsContent>

          <TabsContent value="gameplay" className="flex flex-col gap-2">
            <LinhaDeSlider
              rotulo="Velocidade das notas"
              dica="Quanto maior, mais rápido as notas descem"
              valor={configuracoes.velocidade}
              minimo={1}
              maximo={10}
              passo={1}
              formatar={String}
              aoMudar={(velocidade) => mudar({ velocidade })}
            />
            <LinhaDeSlider
              rotulo="Atraso do áudio"
              dica="Ajuste se as notas parecerem fora do ritmo da música"
              valor={configuracoes.atrasoMs}
              minimo={-200}
              maximo={200}
              passo={5}
              formatar={(v) => `${v > 0 ? "+" : ""}${v} ms`}
              aoMudar={(atrasoMs) => mudar({ atrasoMs })}
            />
            <Calibracao aoMedir={(atrasoMs) => mudar({ atrasoMs })} />
            <LinhaDeOpcao rotulo="Modo sem falha" dica="O medidor de rock nunca tira você da música" para="sem-falha">
              <Switch id="sem-falha" checked={configuracoes.semFalha} onCheckedChange={(semFalha) => mudar({ semFalha })} />
            </LinhaDeOpcao>
            <LinhaDeOpcao rotulo="Bot" dica="O jogo toca sozinho. Recordes não são salvos" para="bot">
              <Switch id="bot" checked={configuracoes.bot} onCheckedChange={(bot) => mudar({ bot })} />
            </LinhaDeOpcao>
          </TabsContent>

          <TabsContent value="audio" className="flex flex-col gap-2">
            <LinhaDeSlider
              rotulo="Volume geral"
              valor={configuracoes.volumeGeral}
              minimo={0}
              maximo={1}
              passo={0.05}
              formatar={porcentagem}
              aoMudar={(volumeGeral) => mudar({ volumeGeral })}
            />
            <p className="px-2 text-base text-texto-suave">Em qualquer tela: Alt + roda do mouse.</p>
            <LinhaDeSlider
              rotulo="Volume da música"
              valor={configuracoes.volumeDaMusica}
              minimo={0}
              maximo={1}
              passo={0.05}
              formatar={porcentagem}
              aoMudar={(volumeDaMusica) => mudar({ volumeDaMusica })}
            />
            <LinhaDeSlider
              rotulo="Volume dos efeitos"
              valor={configuracoes.volumeDosEfeitos}
              minimo={0}
              maximo={1}
              passo={0.05}
              formatar={porcentagem}
              aoMudar={(volumeDosEfeitos) => mudar({ volumeDosEfeitos })}
            />
            <LinhaDeSlider
              rotulo="Música do menu"
              valor={configuracoes.volumeDoPlayer}
              minimo={0}
              maximo={1}
              passo={0.05}
              formatar={porcentagem}
              aoMudar={(volumeDoPlayer) => mudar({ volumeDoPlayer })}
            />
          </TabsContent>

          <TabsContent value="video" className="flex flex-col gap-2">
            <LinhaDeOpcao rotulo="Tela cheia" dica="Atalho: F11" para="tela-cheia">
              <Switch id="tela-cheia" checked={telaCheia} onCheckedChange={(ligada) => void alternarTelaCheia(ligada)} />
            </LinhaDeOpcao>
            <LinhaDeOpcao rotulo="Modo competitivo" dica="Só a pista e o placar na partida. Atalho: Shift+Tab" para="modo-competitivo">
              <Switch id="modo-competitivo" checked={configuracoes.modoCompetitivo} onCheckedChange={(modoCompetitivo) => mudar({ modoCompetitivo })} />
            </LinhaDeOpcao>
            <LinhaDeOpcao rotulo="Efeitos de brilho" dica="Desligue se o jogo estiver travando" para="efeitos">
              <Switch id="efeitos" checked={configuracoes.efeitos} onCheckedChange={(efeitos) => mudar({ efeitos })} />
            </LinhaDeOpcao>
            <LinhaDeOpcao rotulo="Personagem 3D" dica="Desligue para aliviar a placa de vídeo" para="personagem-3d">
              <Switch id="personagem-3d" checked={configuracoes.personagem3d} onCheckedChange={(personagem3d) => mudar({ personagem3d })} />
            </LinhaDeOpcao>
            <LinhaDeOpcao rotulo="Chat global no menu" dica="Precisa estar com a conta conectada" para="chat-global">
              <Switch id="chat-global" checked={configuracoes.chatGlobal === true} onCheckedChange={(chatGlobal) => mudar({ chatGlobal })} />
            </LinhaDeOpcao>
            <LinhaDeOpcao rotulo="Mostrar FPS" dica="Quadros por segundo durante a música" para="mostrar-fps">
              <Switch id="mostrar-fps" checked={configuracoes.mostrarFps} onCheckedChange={(mostrarFps) => mudar({ mostrarFps })} />
            </LinhaDeOpcao>
            <div className="py-2">
              <GrupoDeOpcoes
                titulo="Qualidade do palco 3D (Leve se a pista engasgar)"
                opcoes={QUALIDADES_DO_PALCO}
                valor={configuracoes.qualidadeDoPalco}
                aoEscolher={(qualidadeDoPalco) => mudar({ qualidadeDoPalco })}
              />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
