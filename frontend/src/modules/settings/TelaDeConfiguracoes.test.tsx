import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { definirTelaCheia } from "@/modules/platform";
import { AudioContextFalso } from "@/test/audioFalso";
import { CONFIGURACOES_PADRAO } from "./configuracoes";
import { TelaDeConfiguracoes } from "./TelaDeConfiguracoes";

vi.mock("@/modules/platform", () => ({
  estaEmTelaCheia: vi.fn(async () => false),
  definirTelaCheia: vi.fn(async () => {}),
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
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ teclas: ["KeyQ", "KeyS", "KeyJ", "KeyK", "KeyL"] }));
  });

  it("Esc cancela a troca sem sair da tela", async () => {
    const { aoMudar, aoVoltar, usuario } = abrir();
    await usuario.click(screen.getByRole("button", { name: "Tecla do traste Verde" }));
    await usuario.keyboard("{Escape}");
    expect(aoMudar).not.toHaveBeenCalled();
    expect(aoVoltar).not.toHaveBeenCalled();
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

  it("desliga o personagem 3D e liga o contador de FPS, para comparar o desempenho", async () => {
    const { aoMudar, usuario } = abrir();
    await usuario.click(screen.getByRole("tab", { name: /Vídeo/ }));
    expect(screen.getByRole("switch", { name: "Personagem 3D" })).toBeChecked();
    await usuario.click(screen.getByRole("switch", { name: "Personagem 3D" }));
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ personagem3d: false }));
    await usuario.click(screen.getByRole("switch", { name: "Mostrar FPS" }));
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ mostrarFps: true }));
  });

  it("começa a calibração com o metrônomo", async () => {
    const { usuario } = abrir();
    await usuario.click(screen.getByRole("tab", { name: /Gameplay/ }));
    await usuario.click(screen.getByRole("button", { name: /Calibrar/ }));
    expect(screen.getByText(/junto com o clique/)).toBeInTheDocument();
  });
});
