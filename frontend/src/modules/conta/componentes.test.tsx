import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExcluirConta } from "./ExcluirConta";
import { GanhoDeXp } from "./GanhoDeXp";
import { sessaoDaConta } from "./sessao";

const nivel = (n: number, no: number, proximo: number) => ({ nivel: n, xp_no_nivel: no, xp_para_o_proximo: proximo });

describe("GanhoDeXp", () => {
  it("mostra o XP ganho e o progresso no nível", () => {
    render(<GanhoDeXp xp={{ xp_ganho: 40, antes: nivel(3, 10, 520), depois: nivel(3, 50, 520) }} />);
    expect(screen.getByText("+40 XP")).toBeInTheDocument();
    expect(screen.getByText("Nível 3")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "10");
  });

  it("comemora quando sobe de nível", () => {
    render(<GanhoDeXp xp={{ xp_ganho: 150, antes: nivel(1, 0, 100), depois: nivel(2, 50, 283) }} />);
    expect(screen.getByText("Subiu para o nível 2!")).toBeInTheDocument();
  });
});

describe("ExcluirConta", () => {
  const conta = { id: "1", nome: "Lucas", avatar: null, xp_total: 0, nivel: nivel(1, 0, 100) };

  afterEach(() => vi.restoreAllMocks());

  it("sem conta, não mostra nada", () => {
    const { container } = render(<ExcluirConta />);
    expect(container).toBeEmptyDOMElement();
  });

  it("com conta, pede confirmação antes de excluir", async () => {
    vi.spyOn(sessaoDaConta, "estado").mockReturnValue({ conta, carregando: false });
    const excluir = vi.spyOn(sessaoDaConta, "excluirConta").mockResolvedValue();
    const usuario = userEvent.setup();
    render(<ExcluirConta />);

    await usuario.click(screen.getByRole("button", { name: "Excluir minha conta" }));
    expect(excluir).not.toHaveBeenCalled();
    await usuario.click(screen.getByRole("button", { name: "Excluir para sempre" }));
    expect(excluir).toHaveBeenCalled();
  });
});
