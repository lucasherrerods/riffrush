import { useEffect, useState } from "react";
import { ArrowLeft, Gamepad2, Keyboard, Monitor, RotateCcw, Volume2 } from "lucide-react";
import { capturarBotao, nomeDoBotao, useControleConectado } from "@/modules/gamepad";
import { CORES_DAS_PISTAS, COR_DA_ABERTA, COR_DA_ESTRELA, NOMES_DAS_PISTAS } from "@/modules/rock/gameplay";
import { PISTA_ABERTA } from "@/modules/rock/songs";
import { MODOS_DE_JANELA, definirTelaCheia, ehJanelaNativa, estaEmTelaCheia, monitorAtual, resolucoesDisponiveis } from "@/modules/platform";
import { ESCALA_MINIMA_DE_RENDERIZACAO, QUALIDADES_DO_PALCO } from "@/modules/rock/stage";
import { GrupoDeOpcoes } from "@/shared/ui/GrupoDeOpcoes";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { useTelaEstreita } from "@/shared/hooks/useTelaEstreita";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Calibracao } from "./componentes/Calibracao";
import { LinhaDeOpcao } from "./componentes/LinhaDeOpcao";
import { LinhaDeSlider } from "./componentes/LinhaDeSlider";
import { SeletorDeJeitoDeJogar } from "./componentes/SeletorDeJeitoDeJogar";
import { configuracoesPadrao, INDICE_DA_ESTRELA, INDICE_DA_PALHETA, nomeDaTecla, trocarBotao, trocarTecla, type Configuracoes } from "./configuracoes";

interface Props {
  configuracoes: Configuracoes;
  aoMudar: (configuracoes: Configuracoes) => void;
  aoVoltar: () => void;
}

const porcentagem = (valor: number) => `${Math.round(valor * 100)}%`;

export function TelaDeConfiguracoes({ configuracoes, aoMudar, aoVoltar }: Props) {
  /** Qual tecla está esperando a nova: 0 a 4 são os trastes, 5 é o star power. */
  const estreita = useTelaEstreita();
  const [trocando, setTrocando] = useState<number | null>(null);
  /** Qual botão do controle está esperando o novo, com os mesmos índices. */
  const [trocandoNoControle, setTrocandoNoControle] = useState<number | null>(null);
  const comControle = useControleConectado();
  const [telaCheia, setTelaCheia] = useState(false);
  const [nativa] = useState(ehJanelaNativa);
  const [resolucoes, setResolucoes] = useState<ReturnType<typeof resolucoesDisponiveis>>([]);
  const mudar = (parcial: Partial<Configuracoes>) => aoMudar({ ...configuracoes, ...parcial });

  useEffect(() => {
    estaEmTelaCheia()
      .then(setTelaCheia)
      .catch(() => {});
    if (!nativa) return;
    monitorAtual()
      .then((monitor) => monitor && setResolucoes(resolucoesDisponiveis(monitor)))
      .catch(() => {});
  }, [nativa]);

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
      className="min-w-28 rounded-lg border-2 bg-superficie px-4 py-2 font-mono text-base font-bold max-md:min-w-16 max-md:px-2 max-md:py-1 max-md:text-sm transition-colors hover:bg-superficie-hover"
      style={{ borderColor: trocando === indice ? "var(--cor-texto)" : cor }}
    >
      {trocando === indice ? "Aperte..." : nomeDaTecla(codigo)}
    </button>
  );

  const botaoDoControle = (indice: number, nome: string, botao: number, cor: string) => (
    <button
      aria-label={`Botão do controle ${nome}`}
      onClick={() => setTrocandoNoControle(trocandoNoControle === indice ? null : indice)}
      className="min-w-28 rounded-lg border-2 bg-superficie px-4 py-2 font-mono text-base font-bold max-md:min-w-16 max-md:px-2 max-md:py-1 max-md:text-sm transition-colors hover:bg-superficie-hover"
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
    <div className="respiro-de-tela flex h-full flex-col">
      <header className="flex items-center gap-4 max-md:gap-2">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="titulo-de-tela">Configurações</h1>
        <div className="flex-1" />
        <Button variant="ghost" aria-label="Restaurar padrão" onClick={() => aoMudar(configuracoesPadrao())}>
          <RotateCcw className="opacity-70" /> <span className="max-md:sr-only">Restaurar padrão</span>
        </Button>
      </header>

      <Tabs defaultValue="controles" className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <TabsList className="abas-rolaveis w-full">
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

        <div className="rolagem-de-toque mt-2 min-h-0 flex-1 placa p-2 max-md:mt-1 max-md:p-1.5">
          <TabsContent value="controles" className="flex flex-col gap-2">
            {/* No celular não há teclas para trocar: o star power sai arrastando o dedo para cima, e sem palheta o jeito é sempre tapping. */}
            {estreita ? (
              <>
              <LinhaDeOpcao rotulo="Jeito de jogar" dica="No celular cada toque vale uma nota">
                <span className="text-sm font-semibold">Tapping</span>
              </LinhaDeOpcao>
              <LinhaDeOpcao rotulo="Star Power" dica="Ativa o bônus quando a barra passa da metade">
                <span className="text-sm font-semibold text-estrela">Arraste para cima</span>
              </LinhaDeOpcao>
              </>
            ) : (
              <>
            <SeletorDeJeitoDeJogar
              valor={configuracoes.jeitoDeJogar}
              aoEscolher={(jeitoDeJogar) => mudar({ jeitoDeJogar })}
              teclas={{ verde: nomeDaTecla(configuracoes.teclas[0]), vermelho: nomeDaTecla(configuracoes.teclas[1]), palheta: nomeDaTecla(configuracoes.teclaDaPalheta) }}
            />
            <p className="px-4 py-2 text-base text-texto-suave max-md:px-2 max-md:py-1 max-md:text-sm">
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
            {configuracoes.jeitoDeJogar === "palhetada" && (
              <LinhaDeOpcao rotulo="Palheta" dica="Toca o acorde dos trastes apertados. No controle é o direcional ▲ ▼">
                {botaoDeTecla(INDICE_DA_PALHETA, "da palheta", configuracoes.teclaDaPalheta, "var(--cor-borda)")}
              </LinhaDeOpcao>
            )}
              </>
            )}
          </TabsContent>

          <TabsContent value="gameplay" className="flex flex-col gap-2">
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
            <LinhaDeOpcao rotulo="Nota aberta" dica={estreita ? "Desligada, a nota aberta vira verde e sai no traste verde" : "Desligada, a nota aberta vira verde e sai com a tecla do verde"} para="nota-aberta">
              <Switch id="nota-aberta" checked={configuracoes.notaAberta} onCheckedChange={(notaAberta) => mudar({ notaAberta })} />
            </LinhaDeOpcao>
            <LinhaDeOpcao rotulo="Bot" dica="O jogo toca sozinho. Recordes não são salvos" para="bot">
              <Switch id="bot" checked={configuracoes.bot} onCheckedChange={(bot) => mudar({ bot })} />
            </LinhaDeOpcao>
            {!estreita && (
              <LinhaDeOpcao rotulo="Bloquear teclas do sistema" dica="Na partida, Windows, Alt+Tab e F5 não tiram você do jogo. Ctrl+Alt+Del sempre funciona" para="bloquear-atalhos">
                <Switch id="bloquear-atalhos" checked={configuracoes.bloquearAtalhos} onCheckedChange={(bloquearAtalhos) => mudar({ bloquearAtalhos })} />
              </LinhaDeOpcao>
            )}
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
            {!estreita && <p className="px-2 text-base text-texto-suave">Em qualquer tela: Alt + roda do mouse.</p>}
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
            {nativa ? (
              <div className="flex flex-col gap-3 py-2">
                <GrupoDeOpcoes titulo="Modo de exibição (F11 alterna a tela cheia)" opcoes={MODOS_DE_JANELA} valor={configuracoes.modoDeJanela} aoEscolher={(modoDeJanela) => mudar({ modoDeJanela })} />
                {configuracoes.modoDeJanela === "janela" && resolucoes.length > 0 && (
                  <GrupoDeOpcoes
                    titulo="Resolução da janela"
                    opcoes={[{ id: "livre", rotulo: "Livre" }, ...resolucoes]}
                    valor={configuracoes.resolucaoDaJanela ?? "livre"}
                    aoEscolher={(id) => mudar({ resolucaoDaJanela: id === "livre" ? null : id })}
                  />
                )}
              </div>
            ) : (
              <LinhaDeOpcao rotulo="Tela cheia" dica={estreita ? undefined : "Atalho: F11"} para="tela-cheia">
                <Switch id="tela-cheia" checked={telaCheia} onCheckedChange={(ligada) => void alternarTelaCheia(ligada)} />
              </LinhaDeOpcao>
            )}
            <LinhaDeOpcao rotulo="Modo competitivo" dica={estreita ? "Só a pista, o placar e o clipe na partida" : "Só a pista, o placar e o clipe na partida. Atalho: Shift+Tab"} para="modo-competitivo">
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
            <LinhaDeSlider
              rotulo="Escala de renderização"
              dica="Abaixe se a pista engasgar em telas grandes"
              valor={configuracoes.escalaDeRenderizacao}
              minimo={ESCALA_MINIMA_DE_RENDERIZACAO}
              maximo={1}
              passo={0.05}
              formatar={porcentagem}
              aoMudar={(escalaDeRenderizacao) => mudar({ escalaDeRenderizacao })}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
