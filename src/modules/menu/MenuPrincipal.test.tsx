import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fecharJanela } from "@/modules/platform";
import { AudioContextFalso } from "@/test/audioFalso";
import { MenuPrincipal } from "./MenuPrincipal";

vi.mock("@/modules/platform", () => ({ fecharJanela: vi.fn() }));

function abrir({ noCelular = false } = {}) {
  const acoes = { aoJogar: vi.fn(), aoMultijogador: vi.fn(), aoPersonagem: vi.fn(), aoConfigurar: vi.fn() };
  render(<MenuPrincipal volumeDosEfeitos={0} noCelular={noCelular} {...acoes} />);
  return { ...acoes, usuario: userEvent.setup() };
}

beforeEach(() => vi.stubGlobal("AudioContext", AudioContextFalso));

describe("MenuPrincipal", () => {
  it("mostra o nome do jogo e as opções", () => {
    abrir();
    expect(screen.getByRole("heading", { name: "Riff Rush" })).toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Jogar", "Multijogador", "Personagem", "Configurações", "Sair"]);
  });

  it("Enter abre a opção selecionada, que começa em Jogar", async () => {
    const { aoJogar, usuario } = abrir();
    await usuario.keyboard("{Enter}");
    expect(aoJogar).toHaveBeenCalled();
  });

  it("as setas trocam a opção selecionada, dando a volta", async () => {
    const { aoConfigurar, usuario } = abrir();
    await usuario.keyboard("{ArrowUp}{ArrowUp}{Enter}");
    expect(aoConfigurar).toHaveBeenCalled();
  });

  it("marca a opção selecionada para leitores de tela", async () => {
    const { usuario } = abrir();
    await usuario.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Multijogador" })).toHaveAttribute("aria-current", "true");
  });

  it("Multijogador abre a tela da sala", async () => {
    const { aoMultijogador, usuario } = abrir();
    await usuario.click(screen.getByRole("button", { name: "Multijogador" }));
    expect(aoMultijogador).toHaveBeenCalled();
  });

  it("clicar abre a opção", async () => {
    const { aoPersonagem, usuario } = abrir();
    await usuario.click(screen.getByRole("button", { name: "Personagem" }));
    expect(aoPersonagem).toHaveBeenCalled();
  });

  it("Sair fecha o jogo", async () => {
    const { usuario } = abrir();
    await usuario.click(screen.getByRole("button", { name: "Sair" }));
    expect(fecharJanela).toHaveBeenCalled();
  });
});

describe("MenuPrincipal no celular que entrou pelo QR code", () => {
  it("começa por entrar na sala e não tem Sair (é só fechar a aba)", () => {
    abrir({ noCelular: true });
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Entrar na sala", "Jogar sozinho", "Personagem", "Configurações"]);
  });

  it("Enter já leva para a sala", async () => {
    const { aoMultijogador, usuario } = abrir({ noCelular: true });
    await usuario.keyboard("{Enter}");
    expect(aoMultijogador).toHaveBeenCalled();
  });
});
