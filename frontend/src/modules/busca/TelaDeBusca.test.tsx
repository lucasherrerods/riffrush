import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AcaoDaBusca, Chip, GrupoDeChips, ItemDaBusca, TelaDeBusca } from ".";

const base = { titulo: "Buscar coisas", rotuloDoCampo: "Buscar coisas", placeholder: "Nome", texto: "", aoMudarTexto: () => {}, estado: { tipo: "pronto" as const, vazio: false } };

describe("TelaDeBusca", () => {
  it("tem título, campo e volta com Esc", async () => {
    const aoVoltar = vi.fn();
    render(<TelaDeBusca {...base} aoVoltar={aoVoltar} />);
    expect(screen.getByRole("heading", { name: "Buscar coisas" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Buscar coisas" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(aoVoltar).toHaveBeenCalled();
  });

  it("não volta com Esc quando um modal está aberto", async () => {
    const aoVoltar = vi.fn();
    render(<TelaDeBusca {...base} aoVoltar={aoVoltar} escBloqueado />);
    await userEvent.keyboard("{Escape}");
    expect(aoVoltar).not.toHaveBeenCalled();
  });

  it("mostra carregando, erro e vazio", () => {
    const { rerender } = render(<TelaDeBusca {...base} estado={{ tipo: "carregando" }} />);
    expect(screen.getByText("Buscando…")).toBeInTheDocument();
    rerender(<TelaDeBusca {...base} estado={{ tipo: "erro", mensagem: "caiu" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("caiu");
    rerender(<TelaDeBusca {...base} estado={{ tipo: "pronto", vazio: true }} mensagemDeVazio="Nada aqui." />);
    expect(screen.getByText("Nada aqui.")).toBeInTheDocument();
  });
});

describe("chips", () => {
  it("escolhe uma opção no grupo", async () => {
    const aoMudar = vi.fn();
    render(<GrupoDeChips rotulo="Status" opcoes={[{ id: "a", rotulo: "A" }, { id: "b", rotulo: "B" }]} valor="a" aoMudar={aoMudar} />);
    expect(screen.getByRole("radio", { name: "A" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("radio", { name: "B" }));
    expect(aoMudar).toHaveBeenCalledWith("b");
  });

  it("o chip solto liga e desliga", async () => {
    const aoMudar = vi.fn();
    render(<Chip rotulo="Oficiais" ligado={false} aoMudar={aoMudar} />);
    await userEvent.click(screen.getByRole("button", { name: "Oficiais", pressed: false }));
    expect(aoMudar).toHaveBeenCalledWith(true);
  });
});

describe("ItemDaBusca", () => {
  it("mostra o título, as linhas e a ação", async () => {
    const aoBaixar = vi.fn();
    render(
      <ul>
        <ItemDaBusca titulo="Hit" linhas={["Banda", "Fácil"]} acao={<AcaoDaBusca nome="Hit" estado={{ tipo: "baixavel", aoBaixar }} />} />
      </ul>,
    );
    expect(screen.getByRole("heading", { name: "Hit" })).toBeInTheDocument();
    expect(screen.getByText("Fácil")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Baixar Hit" }));
    expect(aoBaixar).toHaveBeenCalled();
  });

  it("mostra a barra enquanto baixa", () => {
    render(
      <ul>
        <ItemDaBusca titulo="Hit" linhas={[]} progresso={0.5} acao={<AcaoDaBusca nome="Hit" estado={{ tipo: "baixando" }} />} />
      </ul>,
    );
    expect(screen.getByRole("progressbar", { name: "Baixando Hit" })).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByRole("button", { name: "Baixar Hit" })).toBeDisabled();
  });
});
