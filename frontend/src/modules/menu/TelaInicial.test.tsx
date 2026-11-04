import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Play, Search } from "lucide-react";
import { TelaInicial, type OpcaoDaTelaInicial } from "./TelaInicial";

function abrir(extra: Partial<Parameters<typeof TelaInicial>[0]> = {}) {
  const jogar = vi.fn();
  const buscar = vi.fn();
  const opcoes: OpcaoDaTelaInicial[] = [
    { rotulo: "Jogar", icone: Play, acao: jogar },
    { rotulo: "Buscar", icone: Search, acao: buscar },
  ];
  render(<TelaInicial logo={<h1>Logo</h1>} subtitulo="O PALCO É SEU" alavanca={<button type="button">alavanca</button>} opcoes={opcoes} rotuloDoMenu="Menu" {...extra} />);
  return { jogar, buscar, usuario: userEvent.setup() };
}

describe("TelaInicial", () => {
  it("mostra a logo, o subtítulo, a alavanca e as opções", () => {
    abrir();
    expect(screen.getByRole("heading", { name: "Logo" })).toBeInTheDocument();
    expect(screen.getByText("O PALCO É SEU")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "alavanca" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Menu" })).toBeInTheDocument();
  });

  it("as setas andam pelas opções, dando a volta, e o Enter escolhe", async () => {
    const { usuario, jogar, buscar } = abrir();
    await usuario.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: "Buscar" })).toHaveAttribute("aria-current", "true");
    await usuario.keyboard("{Enter}");
    expect(buscar).toHaveBeenCalledOnce();
    expect(jogar).not.toHaveBeenCalled();
  });

  it("pausada, deixa as setas e o Enter para quem está por cima", async () => {
    const { usuario, jogar } = abrir({ pausada: true });
    await usuario.keyboard("{Enter}");
    expect(jogar).not.toHaveBeenCalled();
  });

  it("avisa ao mover e ao escolher, para o modo tocar os efeitos dele", async () => {
    const aoMover = vi.fn();
    const aoEscolher = vi.fn();
    const { usuario } = abrir({ aoMover, aoEscolher });
    await usuario.keyboard("{ArrowDown}{Enter}");
    expect(aoMover).toHaveBeenCalledOnce();
    expect(aoEscolher).toHaveBeenCalledOnce();
  });
});
