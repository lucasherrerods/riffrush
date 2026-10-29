import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { instalarAtalhosDeVolume, obterContextoDeAudio } from "@/modules/audio";
import { PERSONAGEM_PADRAO } from "@/modules/rock/character";
import { carregarMusica, PISTA_ABERTA, type Nota } from "@/modules/rock/songs";
import { AudioContextFalso } from "@/test/audioFalso";
import { OPCOES_PADRAO_DA_PARTIDA, TelaDeJogo, type OpcoesDaPartida } from "./TelaDeJogo";
import { desempacotarReplay, hashDoChart, type EventoDaTransmissao, type Replay } from "./replay";
import { MUSICAS_DE_TESTE } from "@/test/musicas";

vi.mock("@/modules/rock/songs", async (original) => ({
  ...(await original<typeof import("@/modules/rock/songs")>()),
  carregarMusica: vi.fn(),
}));

const ENTRADA = 2.5;
const nota = (tempo: number, pista = 0): Nota => ({ tempo, pista, frase: -1, duracao: 0 });

function carregarCom(notas: Nota[], duracao = 10) {
  vi.mocked(carregarMusica).mockResolvedValue({ audio: {} as AudioBuffer, notas, batidas: [], duracao });
}

function abrir(
  opcoes: Partial<OpcoesDaPartida> = {},
  recorde?: number,
  replay?: Replay,
  transmissao?: (evento: EventoDaTransmissao) => void,
  espectadores?: number,
) {
  const aoSair = vi.fn();
  const aoTerminar = vi.fn();
  render(
    <TelaDeJogo
      musica={MUSICAS_DE_TESTE[0]}
      dificuldade="medio"
      opcoes={{ ...OPCOES_PADRAO_DA_PARTIDA, ...opcoes }}
      personagem={PERSONAGEM_PADRAO}
      recorde={recorde}
      aoSair={aoSair}
      aoTerminar={aoTerminar}
      replay={replay}
      transmissao={transmissao}
      espectadores={espectadores}
    />,
  );
  return { aoSair, aoTerminar, usuario: userEvent.setup() };
}

const audio = () => obterContextoDeAudio() as unknown as AudioContextFalso;
/** Faz o relógio do áudio chegar no segundo `tempo` da música. */
const irPara = (tempo: number) => act(() => void (audio().currentTime = ENTRADA + tempo));

vi.stubGlobal("AudioContext", AudioContextFalso);

let fontesAntes = 0;

/**
 * O título aparece um instante antes de o efeito ligar o teclado, o toque e o loop.
 * Interagir antes disso faz o toque cair no vazio: espera a fonte da música desta partida existir.
 */
async function partidaPronta() {
  await screen.findByRole("heading", { name: "Neon Highway" });
  await waitFor(() => expect(audio().fontes.length).toBeGreaterThan(fontesAntes));
}

// O contexto de áudio é um só para o jogo inteiro: zera o relógio entre os testes.
beforeEach(() => {
  fontesAntes = audio().fontes.length;
  audio().currentTime = 0;
  audio().state = "running";
  vi.clearAllMocks();
});

describe("TelaDeJogo", () => {
  it("mostra o carregamento e depois a música", async () => {
    carregarCom([nota(1)]);
    abrir();
    expect(screen.getByText(/Gravando a banda/)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Neon Highway" })).toBeInTheDocument();
  });

  // Bug: ler o tamanho do canvas logo depois de mudar o estilo dele forçava um recálculo de layout a cada quadro.
  it("mede o canvas por um ResizeObserver, sem ler o tamanho a cada quadro", async () => {
    const observados: Element[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = (alvo: Element) => observados.push(alvo);
        disconnect = () => {};
      },
    );
    const leituras = vi.spyOn(HTMLElement.prototype, "clientWidth", "get");
    carregarCom([nota(1)]);
    abrir();
    await partidaPronta();
    const antes = leituras.mock.calls.length;
    await new Promise((pronto) => setTimeout(pronto, 100));
    expect(observados.some((alvo) => alvo instanceof HTMLCanvasElement)).toBe(true);
    expect(leituras.mock.calls.length).toBe(antes);
    leituras.mockRestore();
    vi.unstubAllGlobals();
    vi.stubGlobal("AudioContext", AudioContextFalso);
  });

  it("mostra o placar no canto superior esquerdo, recebendo os pontos da partida", async () => {
    carregarCom([nota(1)]);
    render(
      <TelaDeJogo
        musica={MUSICAS_DE_TESTE[0]}
        dificuldade="medio"
        opcoes={OPCOES_PADRAO_DA_PARTIDA}
        personagem={PERSONAGEM_PADRAO}
        placar={(pontos) => <p>placar com {pontos} pontos</p>}
        aoSair={vi.fn()}
        aoTerminar={vi.fn()}
      />,
    );
    const placar = await screen.findByText("placar com 0 pontos");
    expect(placar.closest("[data-parte='canto-esquerdo']")).toHaveClass("top-20", "left-6");
  });

  it("carrega as notas do instrumento escolhido e mostra o instrumento no título", async () => {
    carregarCom([nota(1)]);
    render(
      <TelaDeJogo
        musica={MUSICAS_DE_TESTE[0]}
        dificuldade="medio"
        instrumento="baixo"
        opcoes={OPCOES_PADRAO_DA_PARTIDA}
        personagem={PERSONAGEM_PADRAO}
        aoSair={vi.fn()}
        aoTerminar={vi.fn()}
      />,
    );
    expect(carregarMusica).toHaveBeenLastCalledWith(MUSICAS_DE_TESTE[0], "medio", "baixo");
    await partidaPronta();
    expect(screen.getByText(/Baixo · Médio/)).toBeInTheDocument();
  });

  it("faz a contagem regressiva antes da música", async () => {
    carregarCom([nota(1)]);
    abrir();
    expect(await screen.findByText("3")).toBeInTheDocument();
  });

  it("acertar uma nota soma pontos e sequência", async () => {
    carregarCom([nota(0.5)]);
    const { usuario } = abrir();
    await partidaPronta();
    irPara(0.5);
    await usuario.keyboard("a");
    await waitFor(() => expect(screen.getByLabelText("Pontos")).toHaveTextContent("50"));
    expect(screen.getByLabelText("Sequência")).toHaveTextContent("1");
  });

  it("Esc pausa a música e Continuar retoma", async () => {
    carregarCom([nota(5)]);
    const { usuario } = abrir();
    await partidaPronta();
    await usuario.keyboard("{Escape}");
    expect(await screen.findByRole("heading", { name: "Pausado" })).toBeInTheDocument();
    expect(audio().suspend).toHaveBeenCalled();
    audio().resume.mockClear();
    await usuario.click(screen.getByRole("button", { name: /Continuar/ }));
    // Como no começo: 3, 2, 1, e só depois a música volta.
    expect(await screen.findByRole("timer", { name: "Volta em 3" })).toBeInTheDocument();
    expect(audio().resume).not.toHaveBeenCalled();
    await waitFor(() => expect(audio().resume).toHaveBeenCalled(), { timeout: 4500 });
  }, 8000);

  it("Esc durante a contagem da volta pausa de novo, sem a música voltar", async () => {
    carregarCom([nota(5)]);
    const { usuario } = abrir();
    await partidaPronta();
    await usuario.keyboard("{Escape}");
    await screen.findByRole("heading", { name: "Pausado" });
    audio().resume.mockClear();
    await usuario.click(screen.getByRole("button", { name: /Continuar/ }));
    await screen.findByRole("timer", { name: "Volta em 3" });
    await usuario.keyboard("{Escape}");
    expect(await screen.findByRole("heading", { name: "Pausado" })).toBeInTheDocument();
    await new Promise((fim) => setTimeout(fim, 3500));
    expect(audio().resume).not.toHaveBeenCalled();
  }, 8000);

  it("perder o foco da janela pausa", async () => {
    carregarCom([nota(5)]);
    abrir();
    await partidaPronta();
    act(() => void window.dispatchEvent(new Event("blur")));
    expect(await screen.findByRole("heading", { name: "Pausado" })).toBeInTheDocument();
  });

  it("soltar o Alt depois de mexer no volume não pausa, mesmo se o Windows tirar o foco da janela", async () => {
    const desinstalar = instalarAtalhosDeVolume(window);
    carregarCom([nota(5)]);
    abrir();
    await partidaPronta();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt", code: "AltLeft", altKey: true }));
      document.body.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, altKey: true, bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt", code: "AltLeft" }));
      window.dispatchEvent(new Event("blur"));
    });
    expect(screen.queryByRole("heading", { name: "Pausado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Recomeçar/ })).not.toBeInTheDocument();
    desinstalar();
  });

  it("o menu de pausa abre sem nenhum botão em foco, para uma tecla do jogo não recomeçar a partida", async () => {
    carregarCom([nota(5)]);
    const { usuario } = abrir();
    await partidaPronta();
    screen.getByRole("button", { name: "Pausar" }).focus();
    await usuario.keyboard("{Escape}");
    await screen.findByRole("heading", { name: "Pausado" });
    expect(document.activeElement).toBe(document.body);
  });

  it("Sair da música avisa a tela de cima", async () => {
    carregarCom([nota(5)]);
    const { aoSair, usuario } = abrir();
    await partidaPronta();
    await usuario.keyboard("{Escape}");
    await usuario.click(await screen.findByRole("button", { name: /Sair da música/ }));
    expect(aoSair).toHaveBeenCalled();
  });

  it("entrega o resultado quando a música termina", async () => {
    carregarCom([nota(0.5)], 1);
    const { aoTerminar } = abrir();
    await partidaPronta();
    irPara(1.2);
    await waitFor(() => expect(aoTerminar).toHaveBeenCalled());
    expect(aoTerminar.mock.calls[0][0]).toMatchObject({ musicaId: "neon-highway", dificuldade: "medio", total: 1, acertos: 0, derrota: false });
  });

  it("grava as entradas e entrega o replay junto com o resultado", async () => {
    carregarCom([nota(0.5)], 1);
    const { aoTerminar, usuario } = abrir();
    await partidaPronta();
    irPara(0.5);
    await usuario.keyboard("a");
    irPara(1.2);
    await waitFor(() => expect(aoTerminar).toHaveBeenCalled());
    const gerarReplay = aoTerminar.mock.calls[0][1] as () => Promise<Uint8Array>;
    const replay = await desempacotarReplay(await gerarReplay());
    expect(replay.entradas.map((e) => [e.tipo, e.pista])).toEqual([
      ["tocar", 0],
      ["soltar", 0],
    ]);
    expect(replay.hashDoChart).toMatch(/^[0-9a-f]{32}$/);
  });

  it("com o bot a partida não vale para o ranking, então não tem replay", async () => {
    carregarCom([nota(0.5)], 1);
    const { aoTerminar } = abrir({ bot: true });
    await partidaPronta();
    irPara(1.2);
    await waitFor(() => expect(aoTerminar).toHaveBeenCalled());
    expect(aoTerminar.mock.calls[0][1]).toBeUndefined();
  });

  it("assistindo a um replay, as entradas gravadas tocam e o teclado não", async () => {
    carregarCom([nota(0.5), nota(0.8, 1)]);
    const replay: Replay = {
      semFalha: false,
      fantasma: false,
      semAberta: false,
      velocidade: 1,
      hashDoChart: await hashDoChart([nota(0.5), nota(0.8, 1)]),
      entradas: [{ tempo: 0.5, tipo: "tocar", pista: 0 }],
    };
    const { usuario } = abrir({}, undefined, replay);
    await partidaPronta();
    expect(screen.getByText("REPLAY")).toBeInTheDocument();
    irPara(0.6);
    await waitFor(() => expect(screen.getByLabelText("Pontos")).toHaveTextContent("50"));
    irPara(0.8);
    await usuario.keyboard("s");
    irPara(0.85);
    await new Promise((fim) => setTimeout(fim, 50));
    expect(screen.getByLabelText("Pontos")).toHaveTextContent("50");
  });

  it("sem a nota aberta, ela sai no verde e a opção vai para o replay e para a transmissão", async () => {
    carregarCom([nota(0.5, PISTA_ABERTA)], 1);
    const transmissao = vi.fn();
    const { aoTerminar, usuario } = abrir({ semAberta: true }, undefined, undefined, transmissao);
    await partidaPronta();
    await waitFor(() => expect(transmissao).toHaveBeenCalledWith(expect.objectContaining({ tipo: "inicio", semAberta: true })));
    irPara(0.5);
    await usuario.keyboard("a");
    await waitFor(() => expect(screen.getByLabelText("Pontos")).toHaveTextContent("50"));
    irPara(1.2);
    await waitFor(() => expect(aoTerminar).toHaveBeenCalled());
    const replay = await desempacotarReplay(await aoTerminar.mock.calls[0][1]());
    expect(replay.semAberta).toBe(true);
    // O hash é o do chart original: o replay e o ranking continuam reconhecendo a música.
    expect(replay.hashDoChart).toBe(await hashDoChart([nota(0.5, PISTA_ABERTA)]));
  });

  it("o replay sem a nota aberta toca do mesmo jeito, mesmo com a aberta ligada aqui", async () => {
    carregarCom([nota(0.5, PISTA_ABERTA)]);
    const replay: Replay = {
      semFalha: false,
      fantasma: false,
      semAberta: true,
      velocidade: 1,
      hashDoChart: await hashDoChart([nota(0.5, PISTA_ABERTA)]),
      entradas: [{ tempo: 0.5, tipo: "tocar", pista: 0 }],
    };
    abrir({ semAberta: false }, undefined, replay);
    await partidaPronta();
    irPara(0.6);
    await waitFor(() => expect(screen.getByLabelText("Pontos")).toHaveTextContent("50"));
  });

  it("replay gravado em outro chart avisa e não toca", async () => {
    carregarCom([nota(0.5)]);
    abrir({}, undefined, { semFalha: false, fantasma: false, semAberta: false, velocidade: 1, hashDoChart: "0".repeat(32), entradas: [] });
    expect(await screen.findByText(/outra versão do chart/)).toBeInTheDocument();
  });

  it("com gente assistindo, mostra o olho com quantas pessoas são", async () => {
    abrir({}, undefined, undefined, vi.fn(), 2);
    expect(await screen.findByRole("status", { name: "2 pessoas assistindo" })).toHaveTextContent("2");
  });

  it("sem ninguém assistindo, o olho não aparece", async () => {
    abrir({}, undefined, undefined, vi.fn(), 0);
    await screen.findByRole("button", { name: "Pausar" });
    expect(screen.queryByRole("status", { name: /assistindo/ })).not.toBeInTheDocument();
  });

  it("transmite o início, as entradas em lotes e o fim da partida", async () => {
    carregarCom([nota(0.5)], 1);
    const transmissao = vi.fn();
    const { usuario } = abrir({}, undefined, undefined, transmissao);
    await partidaPronta();
    await waitFor(() => expect(transmissao).toHaveBeenCalledWith(expect.objectContaining({ tipo: "inicio", semFalha: false })));
    irPara(0.5);
    await usuario.keyboard("a");
    irPara(1.2);
    await waitFor(() => expect(transmissao).toHaveBeenCalledWith({ tipo: "fim" }));
    const entradas = transmissao.mock.calls.filter(([e]) => e.tipo === "lote").flatMap(([e]) => e.entradas);
    expect(entradas.map((e: { tipo: string }) => e.tipo)).toEqual(["tocar", "soltar"]);
  });

  it("ao vivo, quem assiste não passa do que já chegou", async () => {
    carregarCom([nota(0.5)]);
    const replay: Replay = { semFalha: false, fantasma: false, semAberta: false, velocidade: 1, hashDoChart: await hashDoChart([nota(0.5)]), entradas: [], ateAgora: 0.2 };
    abrir({}, undefined, replay);
    await partidaPronta();
    irPara(1);
    await new Promise((fim) => setTimeout(fim, 50));
    // Sem o limite a nota já teria passado e contado como erro.
    expect(screen.getByLabelText("Sequência")).toHaveTextContent("0");
    expect(screen.queryByText(/errou/i)).not.toBeInTheDocument();
    replay.entradas.push({ tempo: 0.5, tipo: "tocar", pista: 0 });
    replay.ateAgora = 1;
    await waitFor(() => expect(screen.getByLabelText("Pontos")).toHaveTextContent("50"));
  });

  it("mostra a vaia quando a vida acaba", async () => {
    carregarCom(Array.from({ length: 30 }, (_, i) => nota(i * 0.1)), 20);
    abrir();
    await partidaPronta();
    irPara(5);
    expect(await screen.findByRole("heading", { name: /A galera vaiou/ })).toBeInTheDocument();
  });

  it("na velocidade escolhida, a música toca mais rápida, as notas chegam antes e o replay guarda a velocidade", async () => {
    carregarCom([nota(3)]);
    const { aoTerminar, usuario } = abrir({ velocidadeDaMusica: 1.5 });
    await partidaPronta();
    expect(audio().fontes.at(-1)!.playbackRate.value).toBe(1.5);
    expect(screen.getByText("1,5x")).toBeInTheDocument();
    // A nota do segundo 3 da música chega no segundo 2 de tempo real.
    irPara(2);
    await usuario.keyboard("a");
    await waitFor(() => expect(screen.getByLabelText("Sequência")).toHaveTextContent("1"));
    irPara(20);
    await waitFor(() => expect(aoTerminar).toHaveBeenCalled());
    const replay = await desempacotarReplay(await aoTerminar.mock.calls[0][1]());
    expect(replay.velocidade).toBe(1.5);
    expect(aoTerminar.mock.calls[0][0].pontos).toBe(75);
  });

  it("mostra o selo BOT quando o bot está ligado", async () => {
    carregarCom([nota(1)]);
    abrir({ bot: true });
    expect(await screen.findByText("BOT")).toBeInTheDocument();
  });

  it("mostra o personagem ao lado da pista", async () => {
    carregarCom([nota(1)]);
    abrir();
    expect(await screen.findByRole("img", { name: "Personagem Rockstar" })).toBeInTheDocument();
  });

  it("sem o personagem 3D, a partida roda sem ele", async () => {
    carregarCom([nota(1)]);
    abrir({ personagem: false });
    await partidaPronta();
    expect(screen.queryByRole("img", { name: "Personagem Rockstar" })).toBeNull();
  });

  it("mostra o contador de FPS quando pedido, e esconde por padrão", async () => {
    carregarCom([nota(1)]);
    abrir({ mostrarFps: true });
    await partidaPronta();
    expect(screen.getByText(/FPS/)).toBeInTheDocument();
  });

  it("não mostra FPS por padrão", async () => {
    carregarCom([nota(1)]);
    abrir();
    await partidaPronta();
    expect(screen.queryByText(/FPS/)).toBeNull();
  });

  it("o personagem reage quando o jogador erra uma nota", async () => {
    carregarCom([nota(0.5), nota(5)]);
    abrir();
    await partidaPronta();
    const personagem = screen.getByRole("img", { name: "Personagem Rockstar" });
    expect(personagem).not.toHaveAttribute("data-reacao");
    irPara(1);
    await waitFor(() => expect(personagem).toHaveAttribute("data-reacao", "errou"));
  });

  it("o personagem desaba quando a galera vaia", async () => {
    carregarCom(Array.from({ length: 30 }, (_, i) => nota(i * 0.1)), 20);
    abrir();
    await partidaPronta();
    irPara(5);
    await screen.findByRole("heading", { name: /A galera vaiou/ });
    expect(screen.getByRole("img", { name: "Personagem Rockstar" })).toHaveAttribute("data-reacao", "derrota");
  });
});

describe("TelaDeJogo em rede", () => {
  function abrirEmRede(inicio: number) {
    const aoAtualizar = vi.fn();
    const aoTerminar = vi.fn();
    render(
      <TelaDeJogo
        musica={MUSICAS_DE_TESTE[0]}
        dificuldade="medio"
        opcoes={OPCOES_PADRAO_DA_PARTIDA}
        personagem={PERSONAGEM_PADRAO}
        rede={{ inicio, aoAtualizar, adversarios: <p>painel dos adversários</p> }}
        aoSair={vi.fn()}
        aoTerminar={aoTerminar}
      />,
    );
    return { aoAtualizar, aoTerminar, usuario: userEvent.setup() };
  }
  /** Espera a tela criar a fonte da música desta partida (a lista guarda as de testes anteriores). */
  async function fonteNova(antes: number) {
    await waitFor(() => expect(audio().fontes.length).toBeGreaterThan(antes));
    return audio().fontes.at(-1)!;
  }

  it("começa a música no instante combinado com a sala", async () => {
    carregarCom([nota(5)]);
    const antes = audio().fontes.length;
    abrirEmRede(performance.now() + 5000);
    const inicio = (await fonteNova(antes)).inicio!;
    // Alguns décimos de segundo passam até a música carregar; a largada continua sendo a combinada.
    expect(inicio).toBeGreaterThan(3.5);
    expect(inicio).toBeLessThanOrEqual(5);
  });

  it("quem carregou atrasado entra no meio da música", async () => {
    carregarCom([nota(5)]);
    const antes = audio().fontes.length;
    abrirEmRede(performance.now() - 2000);
    expect((await fonteNova(antes)).deslocamento).toBeGreaterThan(1.9);
  });

  it("quando a vida acaba, vira fantasma e continua tocando, sem vaia", async () => {
    carregarCom(Array.from({ length: 30 }, (_, i) => nota(i * 0.1)), 20);
    const { aoAtualizar, aoTerminar } = abrirEmRede(performance.now());
    await partidaPronta();
    irPara(5);
    expect(await screen.findByLabelText("Virou fantasma")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /A galera vaiou/ })).toBeNull();
    expect(aoTerminar).not.toHaveBeenCalled();
    await waitFor(() => expect(aoAtualizar).toHaveBeenCalledWith(expect.objectContaining({ fantasma: true, derrota: false })));
  });

  it("fantasma também entrega o replay no fim, para a API conferir a partida", async () => {
    carregarCom(Array.from({ length: 30 }, (_, i) => nota(i * 0.1)), 6);
    const { aoTerminar } = abrirEmRede(performance.now());
    await partidaPronta();
    irPara(5);
    expect(await screen.findByLabelText("Virou fantasma")).toBeInTheDocument();
    irPara(7);
    await waitFor(() => expect(aoTerminar).toHaveBeenCalled());
    expect(aoTerminar.mock.calls[0][0]).toMatchObject({ fantasma: true });
    expect(aoTerminar.mock.calls[0][1]).toBeTypeOf("function");
  });

  it("manda o estado do jogador para a sala", async () => {
    carregarCom([nota(5)]);
    const { aoAtualizar } = abrirEmRede(performance.now() + 5000);
    await waitFor(() => expect(aoAtualizar).toHaveBeenCalledWith(expect.objectContaining({ pontos: 0, vida: 0.5, terminou: false })));
  });

  it("a pausa só abre o menu: a música dos outros não para", async () => {
    carregarCom([nota(5)]);
    const { usuario } = abrirEmRede(performance.now() + 5000);
    await partidaPronta();
    await usuario.keyboard("{Escape}");
    expect(await screen.findByRole("heading", { name: "Menu" })).toBeInTheDocument();
    expect(audio().suspend).not.toHaveBeenCalled();
  });

  it("desistir entrega o resultado como derrota", async () => {
    carregarCom([nota(5)]);
    const { aoTerminar, usuario } = abrirEmRede(performance.now() + 5000);
    await partidaPronta();
    await usuario.keyboard("{Escape}");
    await usuario.click(await screen.findByRole("button", { name: /Desistir e ver placar/ }));
    expect(aoTerminar).toHaveBeenCalledWith(expect.objectContaining({ derrota: true }));
  });

  it("mostra o painel dos adversários", async () => {
    carregarCom([nota(5)]);
    abrirEmRede(performance.now() + 5000);
    expect(await screen.findByText("painel dos adversários")).toBeInTheDocument();
  });
});

describe("TelaDeJogo com toque", () => {
  it("tem uma área de toque embaixo de cada traste, na ordem", async () => {
    carregarCom([nota(5)]);
    abrir();
    await partidaPronta();
    const areas = screen.getAllByRole("button", { name: /^Traste / });
    expect(areas.map((a) => a.getAttribute("aria-label"))).toEqual(["Traste Verde", "Traste Vermelho", "Traste Amarelo", "Traste Azul", "Traste Laranja"]);
  });

  it("sem nota aberta na música, não tem a faixa dela", async () => {
    carregarCom([nota(5)]);
    abrir();
    await partidaPronta();
    expect(screen.queryByRole("button", { name: "Nota aberta" })).not.toBeInTheDocument();
  });

  it("com nota aberta, tocar na faixa do pé da tela acerta a aberta", async () => {
    carregarCom([nota(0.5, 5)]);
    abrir();
    await partidaPronta();
    irPara(0.55);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Nota aberta" }));
    await waitFor(() => expect(screen.getByLabelText("Pontos")).toHaveTextContent("50"));
  });

  it("tocar na área do traste acerta a nota", async () => {
    carregarCom([nota(0.5, 2)]);
    abrir();
    await partidaPronta();
    irPara(0.55);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Traste Amarelo" }));
    await waitFor(() => expect(screen.getByLabelText("Pontos")).toHaveTextContent("50"));
  });

  it("tirar o dedo larga o sustain e para de somar pontos", async () => {
    carregarCom([{ ...nota(0.5), duracao: 2 }]);
    abrir();
    await partidaPronta();
    irPara(0.55);
    const verde = screen.getByRole("button", { name: "Traste Verde" });
    fireEvent.pointerDown(verde);
    irPara(1);
    await waitFor(() => expect(Number(screen.getByLabelText("Pontos").textContent!.replace(/\D/g, ""))).toBeGreaterThan(50));
    fireEvent.pointerUp(verde);
    const aoSoltar = screen.getByLabelText("Pontos").textContent;
    irPara(2);
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getByLabelText("Pontos").textContent).toBe(aoSoltar);
  });
});

describe("TelaDeJogo no celular", () => {
  beforeEach(() => Object.defineProperty(window, "innerWidth", { value: 375, configurable: true }));
  afterEach(() => Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true }));

  it("troca o painel lateral por um painel compacto no topo", async () => {
    carregarCom([nota(5)]);
    abrir();
    await partidaPronta();
    expect(document.querySelector('[data-parte="hud-compacto"]')).not.toBeNull();
    expect(document.querySelector('[data-parte="hud-lateral"]')).toBeNull();
  });

  it("no topo, o medidor de rock mostra a vida e os pinos do star power", async () => {
    carregarCom([nota(5)]);
    abrir();
    await partidaPronta();
    const hud = document.querySelector('[data-parte="hud-compacto"]') as HTMLElement;
    expect(within(hud).getByRole("meter", { name: "Vida" })).toBeInTheDocument();
    expect(within(hud).getByRole("progressbar", { name: "Star power" })).toBeInTheDocument();
  });

  it("mostra um alvo de toque embaixo de cada traste", async () => {
    carregarCom([nota(5)]);
    abrir();
    await partidaPronta();
    expect(document.querySelectorAll('[data-parte="alvo-do-toque"]')).toHaveLength(5);
  });

  it("o star power vira um botão para tocar com o dedo", async () => {
    carregarCom([nota(5)]);
    abrir();
    expect(await screen.findByRole("button", { name: /Ativar star power/ })).not.toHaveTextContent("%");
    expect(document.querySelector('[data-parte="seta-do-star-power"]')).toBeNull();
  });

  it("o personagem continua aparecendo", async () => {
    carregarCom([nota(5)]);
    abrir();
    expect(await screen.findByRole("img", { name: "Personagem Rockstar" })).toBeInTheDocument();
  });
});

describe("TelaDeJogo e as estrelas", () => {
  it("escurece as bordas da tela com uma vinheta, como luz de palco", async () => {
    carregarCom([nota(1)]);
    abrir();
    await partidaPronta();
    expect(document.querySelector('[data-parte="vinheta"]')).toHaveClass("pointer-events-none");
  });

  it("mostra a barra de estrelas, que começa vazia", async () => {
    carregarCom([nota(1), nota(2)]);
    abrir();
    await partidaPronta();
    expect(screen.getByRole("meter", { name: "Estrelas" })).toHaveAttribute("aria-valuenow", "0");
  });

  it("marca o recorde da música na barra", async () => {
    // 2 notas valem 100 pontos de base; 280 pontos são as 5 estrelas.
    carregarCom([nota(1), nota(2)]);
    abrir({}, 280);
    await partidaPronta();
    expect(await screen.findByLabelText("Recorde: 5 estrelas")).toBeInTheDocument();
  });

  it("avisa na tela quando o jogador passa o recorde", async () => {
    carregarCom([nota(0.5)]);
    const { usuario } = abrir({}, 40);
    await partidaPronta();
    irPara(0.5);
    await usuario.keyboard("a");
    expect(await screen.findByText("RECORDE BATIDO!")).toBeInTheDocument();
  });

  it("com o bot tocando, o recorde não vale e não tem aviso", async () => {
    carregarCom([nota(0.5)]);
    abrir({ bot: true }, 40);
    await partidaPronta();
    irPara(0.6);
    await waitFor(() => expect(screen.getByLabelText("Pontos")).toHaveTextContent("50"));
    expect(screen.queryByText("RECORDE BATIDO!")).not.toBeInTheDocument();
  });

  it("sem recorde, não avisa", async () => {
    carregarCom([nota(0.5)]);
    const { usuario } = abrir();
    await partidaPronta();
    irPara(0.5);
    await usuario.keyboard("a");
    await waitFor(() => expect(screen.getByLabelText("Pontos")).toHaveTextContent("50"));
    expect(screen.queryByText("RECORDE BATIDO!")).not.toBeInTheDocument();
  });
});
