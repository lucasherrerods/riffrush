import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { abrirLink } from "@/modules/platform";
import { AudioContextFalso } from "@/test/audioFalso";
import { MenuPrincipal } from "./MenuPrincipal";

vi.mock("@/modules/platform", () => ({ abrirLink: vi.fn() }));

function abrir({ noCelular = false, comLeaderboard = true, chat }: { noCelular?: boolean; comLeaderboard?: boolean; chat?: ReactNode } = {}) {
  const acoes = {
    aoJogar: vi.fn(),
    aoMultijogador: vi.fn(),
    aoPersonagem: vi.fn(),
    aoConfigurar: vi.fn(),
    aoBuscarMusicas: vi.fn(),
    aoLeaderboard: comLeaderboard ? vi.fn() : undefined,
    aoAbrirDocumento: vi.fn(),
  };
  render(<MenuPrincipal volumeDosEfeitos={0} noCelular={noCelular} chat={chat} {...acoes} />);
  return { ...acoes, usuario: userEvent.setup() };
}

beforeEach(() => vi.stubGlobal("AudioContext", AudioContextFalso));

describe("MenuPrincipal", () => {
  it("mostra o nome do jogo e as opções", () => {
    abrir();
    expect(screen.getByRole("heading", { name: "Riff Rush Rock" })).toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Jogar", "Multiplayer", "Buscar músicas", "Leaderboard", "Personagem", "Configurações"]);
  });

  it("Enter abre a opção selecionada, que começa em Jogar", async () => {
    const { aoJogar, usuario } = abrir();
    await usuario.keyboard("{Enter}");
    expect(aoJogar).toHaveBeenCalled();
  });

  it("as setas trocam a opção selecionada, dando a volta", async () => {
    const { aoConfigurar, usuario } = abrir();
    await usuario.keyboard("{ArrowUp}{Enter}");
    expect(aoConfigurar).toHaveBeenCalled();
  });

  it("marca a opção selecionada para leitores de tela", async () => {
    const { usuario } = abrir();
    await usuario.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Multiplayer" })).toHaveAttribute("aria-current", "true");
  });

  it("Multiplayer abre a tela da sala", async () => {
    const { aoMultijogador, usuario } = abrir();
    await usuario.click(screen.getByRole("button", { name: "Multiplayer" }));
    expect(aoMultijogador).toHaveBeenCalled();
  });

  it("com a tela dividida disponível, ela aparece depois do Multiplayer e abre a escolha de dispositivos", async () => {
    const aoTelaDividida = vi.fn();
    render(<MenuPrincipal volumeDosEfeitos={0} aoJogar={vi.fn()} aoMultijogador={vi.fn()} aoPersonagem={vi.fn()} aoConfigurar={vi.fn()} aoBuscarMusicas={vi.fn()} aoAbrirDocumento={vi.fn()} aoTelaDividida={aoTelaDividida} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent).slice(0, 3)).toEqual(["Jogar", "Multiplayer", "Tela dividida"]);
    await userEvent.click(screen.getByRole("button", { name: "Tela dividida" }));
    expect(aoTelaDividida).toHaveBeenCalled();
  });

  it("clicar abre a opção", async () => {
    const { aoPersonagem, usuario } = abrir();
    await usuario.click(screen.getByRole("button", { name: "Personagem" }));
    expect(aoPersonagem).toHaveBeenCalled();
  });

  it("com o relay e contas, Online abre a lista de quem está online", async () => {
    const aoOnline = vi.fn();
    render(
      <MenuPrincipal
        volumeDosEfeitos={0}
        aoJogar={vi.fn()}
        aoMultijogador={vi.fn()}
        aoPersonagem={vi.fn()}
        aoConfigurar={vi.fn()}
        aoBuscarMusicas={vi.fn()}
        aoOnline={aoOnline}
        aoAbrirDocumento={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Online" }));
    expect(aoOnline).toHaveBeenCalled();
  });

  it("Leaderboard abre o ranking geral", async () => {
    const { aoLeaderboard, usuario } = abrir();
    await usuario.click(screen.getByRole("button", { name: "Leaderboard" }));
    expect(aoLeaderboard).toHaveBeenCalled();
  });

  it("sem contas ligadas, o Leaderboard não aparece", () => {
    abrir({ comLeaderboard: false });
    expect(screen.queryByRole("button", { name: "Leaderboard" })).not.toBeInTheDocument();
  });
});

describe("MenuPrincipal rodapé", () => {
  it("não mostra mais a dica de comandos", () => {
    abrir();
    expect(screen.queryByText(/para navegar/)).not.toBeInTheDocument();
    expect(screen.queryByText(/para escolher/)).not.toBeInTheDocument();
  });

  it("mostra os direitos autorais no canto direito", () => {
    abrir();
    expect(screen.getByText(/© 2026/)).toBeInTheDocument();
  });

  it("o ícone do GitHub abre o repositório do projeto", async () => {
    const { usuario } = abrir();
    const link = screen.getByRole("link", { name: "Riff Rush no GitHub" });
    expect(link).toHaveAttribute("href", "https://github.com/lucasherrerods/riffrush");
    await usuario.click(link);
    expect(abrirLink).toHaveBeenCalledWith("https://github.com/lucasherrerods/riffrush");
  });
});

describe("MenuPrincipal no celular que entrou pelo QR code", () => {
  it("começa por entrar na sala", () => {
    abrir({ noCelular: true });
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Entrar na sala", "Jogar sozinho", "Buscar músicas", "Leaderboard", "Personagem", "Configurações"]);
  });

  it("Enter já leva para a sala", async () => {
    const { aoMultijogador, usuario } = abrir({ noCelular: true });
    await usuario.keyboard("{Enter}");
    expect(aoMultijogador).toHaveBeenCalled();
  });
});

describe("MenuPrincipal na tela estreita", () => {
  // Bug: com espaçamento largo entre letras, o subtítulo estourava a largura do celular.
  it("o subtítulo diminui o espaçamento e quebra a linha centralizado", () => {
    abrir();
    expect(screen.getByText("O PALCO É SEU")).toHaveClass("max-md:tracking-[0.15em]", "text-center");
  });

  it("o rodapé abre a privacidade e os termos dentro do jogo", async () => {
    const { aoAbrirDocumento, usuario } = abrir();
    await usuario.click(screen.getByRole("link", { name: "Política de Privacidade" }));
    await usuario.click(screen.getByRole("link", { name: "Termos de Uso" }));
    expect(aoAbrirDocumento.mock.calls).toEqual([["privacidade"], ["termos"]]);
  });

  it("o rodapé leva para a página Sobre, a landing do jogo", async () => {
    const { usuario } = abrir();
    const link = screen.getByRole("link", { name: "Sobre" });
    expect(link).toHaveAttribute("href", "https://playriffrush.vercel.app");
    await usuario.click(link);
    expect(abrirLink).toHaveBeenCalledWith("https://playriffrush.vercel.app");
  });

  it("mostra o chat no canto de baixo, à esquerda", () => {
    abrir({ chat: <p>o chat</p> });
    expect(screen.getByRole("complementary", { name: "Chat" })).toHaveTextContent("o chat");
  });
});
