import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { capturarBotao, useControleConectado } from "@/modules/gamepad";
import { definirTelaCheia, ehJanelaNativa } from "@/modules/platform";
import { AudioContextFalso } from "@/test/audioFalso";
import { CONFIGURACOES_PADRAO } from "./configuracoes";
import { TelaDeConfiguracoes } from "./TelaDeConfiguracoes";

vi.mock("@/modules/gamepad", async (original) => ({
  ...(await original<typeof import("@/modules/gamepad")>()),
  useControleConectado: vi.fn(() => false),
  capturarBotao: vi.fn(() => () => {}),
}));

vi.mock("@/modules/platform", () => ({
  estaEmTelaCheia: vi.fn(async () => false),
  definirTelaCheia: vi.fn(async () => {}),
  ehJanelaNativa: vi.fn(() => false),
  monitorAtual: vi.fn(async () => ({ x: 0, y: 0, largura: 1920, altura: 1080 })),
  resolucoesDisponiveis: () => [{ id: "1600x900", rotulo: "1600 × 900", largura: 1600, altura: 900 }],
  MODOS_DE_JANELA: [
    { id: "janela", rotulo: "Janela" },
    { id: "sem-borda", rotulo: "Sem borda" },
    { id: "tela-cheia", rotulo: "Tela cheia" },
  ],
}));

function abrir() {
  const aoMudar = vi.fn();
  const aoVoltar = vi.fn();
  render(<TelaDeConfiguracoes configuracoes={CONFIGURACOES_PADRAO} aoMudar={aoMudar} aoVoltar={aoVoltar} />);
  return { aoMudar, aoVoltar, usuario: userEvent.setup() };
}

beforeEach(() => vi.stubGlobal("AudioContext", AudioContextFalso));

describe("TelaDeConfiguracoes", () => {
  it("mostra a tecla de cada traste", () => {
    abrir();
    expect(screen.getByRole("button", { name: "Tecla do traste Verde" })).toHaveTextContent("A");
    expect(screen.getByRole("button", { name: "Tecla do traste Laranja" })).toHaveTextContent("L");
  });

  it("troca a tecla de um traste pela próxima tecla apertada", async () => {
    const { aoMudar, usuario } = abrir();
    await usuario.click(screen.getByRole("button", { name: "Tecla do traste Verde" }));
    expect(screen.getByRole("button", { name: "Tecla do traste Verde" })).toHaveTextContent("Aperte...");
    await usuario.keyboard("q");
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ teclas: ["KeyQ", "KeyS", "KeyJ", "KeyK", "KeyL", "KeyD"] }));
  });

  it("Esc cancela a troca sem sair da tela", async () => {
    const { aoMudar, aoVoltar, usuario } = abrir();
    await usuario.click(screen.getByRole("button", { name: "Tecla do traste Verde" }));
    await usuario.keyboard("{Escape}");
    expect(aoMudar).not.toHaveBeenCalled();
    expect(aoVoltar).not.toHaveBeenCalled();
  });

  it("o jeito de jogar fica no topo dos controles, com um só escolhido", async () => {
    const { aoMudar, usuario } = abrir();
    const grupo = screen.getByRole("radiogroup", { name: "Jeito de jogar" });
    expect(screen.getByRole("radio", { name: /Gamepad/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /Tapping/ })).toHaveAttribute("aria-checked", "false");
    expect(grupo.compareDocumentPosition(screen.getByLabelText("Tecla do traste Verde")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await usuario.click(screen.getByRole("radio", { name: /Palhetada/ }));
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ jeitoDeJogar: "palhetada" }));
  });

  it("a ajuda de cada jeito abre uma janela explicando como ele funciona", async () => {
    const { usuario } = abrir();
    await usuario.click(screen.getByRole("button", { name: "Como funciona o Palhetada" }));
    const janela = screen.getByRole("dialog");
    expect(janela).toHaveTextContent("Palhetada");
    expect(janela).toHaveTextContent("segure A e S e aperte Enter");
  });

  it("a tecla da palheta só aparece na palhetada", () => {
    const { unmount } = render(<TelaDeConfiguracoes configuracoes={CONFIGURACOES_PADRAO} aoMudar={vi.fn()} aoVoltar={vi.fn()} />);
    expect(screen.queryByLabelText("Tecla da palheta")).not.toBeInTheDocument();
    unmount();
    render(<TelaDeConfiguracoes configuracoes={{ ...CONFIGURACOES_PADRAO, jeitoDeJogar: "palhetada" }} aoMudar={vi.fn()} aoVoltar={vi.fn()} />);
    expect(screen.getByLabelText("Tecla da palheta")).toHaveTextContent("Enter");
  });

  it("Esc volta para o menu", async () => {
    const { aoVoltar, usuario } = abrir();
    await usuario.keyboard("{Escape}");
    expect(aoVoltar).toHaveBeenCalled();
  });

  it("restaura o padrão", async () => {
    const { aoMudar, usuario } = abrir();
    await usuario.click(screen.getByRole("button", { name: /Restaurar padrão/ }));
    expect(aoMudar).toHaveBeenCalledWith(CONFIGURACOES_PADRAO);
  });

  it("liga o modo sem falha", async () => {
    const { aoMudar, usuario } = abrir();
    await usuario.click(screen.getByRole("tab", { name: /Gameplay/ }));
    await usuario.click(screen.getByRole("switch", { name: "Modo sem falha" }));
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ semFalha: true }));
  });

  it("desliga a nota aberta", async () => {
    const { aoMudar, usuario } = abrir();
    await usuario.click(screen.getByRole("tab", { name: /Gameplay/ }));
    await usuario.click(screen.getByRole("switch", { name: "Nota aberta" }));
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ notaAberta: false }));
  });

  it("escolhe a qualidade do palco no vídeo", async () => {
    const { aoMudar, usuario } = abrir();
    await usuario.click(screen.getByRole("tab", { name: /Vídeo/ }));
    await usuario.click(screen.getByRole("radio", { name: "Leve" }));
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ qualidadeDoPalco: "leve" }));
  });

  it("liga a tela cheia", async () => {
    const { usuario } = abrir();
    await usuario.click(screen.getByRole("tab", { name: /Vídeo/ }));
    await usuario.click(screen.getByRole("switch", { name: "Tela cheia" }));
    expect(definirTelaCheia).toHaveBeenCalledWith(true);
  });

  it("no desktop escolhe o modo de exibição e a resolução da janela", async () => {
    vi.mocked(ehJanelaNativa).mockReturnValue(true);
    const { aoMudar, usuario } = abrir();
    await usuario.click(screen.getByRole("tab", { name: /Vídeo/ }));
    expect(screen.queryByRole("switch", { name: "Tela cheia" })).toBeNull();
    await usuario.click(await screen.findByRole("radio", { name: "1600 × 900" }));
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ resolucaoDaJanela: "1600x900" }));
    await usuario.click(screen.getByRole("radio", { name: "Sem borda" }));
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ modoDeJanela: "sem-borda" }));
    vi.mocked(ehJanelaNativa).mockReturnValue(false);
  });

  it("desliga o personagem 3D e liga o contador de FPS, para comparar o desempenho", async () => {
    const { aoMudar, usuario } = abrir();
    await usuario.click(screen.getByRole("tab", { name: /Vídeo/ }));
    expect(screen.getByRole("switch", { name: "Personagem 3D" })).toBeChecked();
    await usuario.click(screen.getByRole("switch", { name: "Personagem 3D" }));
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ personagem3d: false }));
    await usuario.click(screen.getByRole("switch", { name: "Mostrar FPS" }));
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ mostrarFps: true }));
  });

  it("desliga o bloqueio das teclas do sistema na partida, que começa ligado", async () => {
    const { aoMudar, usuario } = abrir();
    await usuario.click(screen.getByRole("tab", { name: /Gameplay/ }));
    expect(screen.getByRole("switch", { name: "Bloquear teclas do sistema" })).toBeChecked();
    await usuario.click(screen.getByRole("switch", { name: "Bloquear teclas do sistema" }));
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ bloquearAtalhos: false }));
  });

  it("liga o chat global do menu, que começa desligado", async () => {
    const { aoMudar, usuario } = abrir();
    await usuario.click(screen.getByRole("tab", { name: /Vídeo/ }));
    await usuario.click(screen.getByRole("switch", { name: "Chat global no menu" }));
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ chatGlobal: true }));
  });

  it("começa a calibração com o metrônomo", async () => {
    const { usuario } = abrir();
    await usuario.click(screen.getByRole("tab", { name: /Gameplay/ }));
    await usuario.click(screen.getByRole("button", { name: /Calibrar/ }));
    expect(screen.getByText(/junto com o clique/)).toBeInTheDocument();
  });

  it("velocidade das notas e inclinação da pista são fixas: não aparecem para configurar", async () => {
    const { usuario } = abrir();
    await usuario.click(screen.getByRole("tab", { name: /Gameplay/ }));
    expect(screen.queryByText("Velocidade das notas")).toBeNull();
    expect(screen.queryByText("Inclinação da pista")).toBeNull();
  });

  it("desliga o modo competitivo no vídeo", async () => {
    const { aoMudar, usuario } = abrir();
    await usuario.click(screen.getByRole("tab", { name: /Vídeo/ }));
    await usuario.click(screen.getByRole("switch", { name: "Modo competitivo" }));
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ modoCompetitivo: false }));
  });

  it("sem controle, não mostra os botões do controle", () => {
    abrir();
    expect(screen.queryByRole("button", { name: "Botão do controle do traste Verde" })).not.toBeInTheDocument();
  });

  it("com controle, troca o botão do traste pelo próximo botão apertado no controle", async () => {
    vi.mocked(useControleConectado).mockReturnValue(true);
    const { aoMudar, usuario } = abrir();
    const botao = screen.getByRole("button", { name: "Botão do controle do traste Verde" });
    expect(botao).toHaveTextContent("LT");

    await usuario.click(botao);
    expect(botao).toHaveTextContent("Aperte...");
    // O controle devolve o X (índice 2).
    const escolher = vi.mocked(capturarBotao).mock.lastCall![0];
    escolher(2);

    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ botoesDoControle: [2, 4, 5, 7, 0, 6], teclas: CONFIGURACOES_PADRAO.teclas }));
    vi.mocked(useControleConectado).mockReturnValue(false);
  });

describe("no celular", () => {
  beforeEach(() => Object.defineProperty(window, "innerWidth", { value: 375, configurable: true }));
  afterEach(() => Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true }));

  it("troca a troca de teclas pela dica de arrastar para cima e esconde os atalhos de teclado", () => {
    render(<TelaDeConfiguracoes configuracoes={CONFIGURACOES_PADRAO} aoMudar={vi.fn()} aoVoltar={vi.fn()} />);
    expect(screen.getByText("Arraste para cima")).toBeInTheDocument();
    expect(screen.queryByText("Traste Verde")).not.toBeInTheDocument();
    expect(screen.queryByText(/Atalho|Alt \+|Esc cancela/)).not.toBeInTheDocument();
  });
});
});
