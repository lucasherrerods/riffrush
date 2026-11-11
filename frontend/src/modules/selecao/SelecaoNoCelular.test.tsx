import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelecaoNoCelular } from "./SelecaoNoCelular";

function montar(props: Partial<React.ComponentProps<typeof SelecaoNoCelular>> = {}) {
  const aoTocar = vi.fn();
  const aoVoltar = vi.fn();
  const ouvirTeclas = (e: KeyboardEvent) => e.code === "Escape" && aoVoltar();
  window.addEventListener("keydown", ouvirTeclas);
  render(
    <SelecaoNoCelular
      cabecalho={<header>topo</header>}
      filtros={<input aria-label="Buscar" />}
      lista={<ul aria-label="Mapas" />}
      titulo="My Feelings"
      subtitulo="Dan Salvato"
      detalhes={<p>BPM 120</p>}
      ranking={<p>top do mapa</p>}
      tocar={<button onClick={aoTocar}>TOCAR</button>}
      {...props}
    />,
  );
  return { aoTocar, aoVoltar, limpar: () => window.removeEventListener("keydown", ouvirTeclas) };
}

describe("SelecaoNoCelular", () => {
  // Bug: no celular detalhes, ranking e filtros empilhados deixavam a lista minúscula.
  it("começa só com a lista, o resumo e o tocar; detalhes, ranking e filtros ficam recolhidos", () => {
    const { limpar } = montar();
    expect(screen.getByRole("list", { name: "Mapas" })).toBeInTheDocument();
    expect(screen.getByText("My Feelings")).toBeInTheDocument();
    expect(screen.queryByText("top do mapa")).not.toBeInTheDocument();
    expect(screen.queryByText("BPM 120")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Buscar" })).not.toBeInTheDocument();
    limpar();
  });

  it("o tocar fica sempre à mão no rodapé", async () => {
    const { aoTocar, limpar } = montar();
    await userEvent.click(within(screen.getByRole("contentinfo")).getByRole("button", { name: "TOCAR" }));
    expect(aoTocar).toHaveBeenCalled();
    limpar();
  });

  it("tocar no resumo abre a gaveta com ranking e detalhes em abas", async () => {
    const { limpar } = montar();
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: /My Feelings/ }));
    expect(screen.getByText("top do mapa")).toBeInTheDocument();
    await usuario.click(screen.getByRole("tab", { name: /Detalhes/ }));
    expect(screen.getByText("BPM 120")).toBeInTheDocument();
    limpar();
  });

  it("sem ranking, a gaveta abre direto nos detalhes", async () => {
    const { limpar } = montar({ ranking: undefined });
    await userEvent.click(screen.getByRole("button", { name: /My Feelings/ }));
    expect(screen.getByText("BPM 120")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Ranking/ })).not.toBeInTheDocument();
    limpar();
  });

  it("Esc fecha a gaveta sem passar a tecla para a tela", async () => {
    const { aoVoltar, limpar } = montar();
    await userEvent.click(screen.getByRole("button", { name: /My Feelings/ }));
    fireEvent.keyDown(window, { code: "Escape", key: "Escape" });
    expect(screen.queryByText("top do mapa")).not.toBeInTheDocument();
    expect(aoVoltar).not.toHaveBeenCalled();
    limpar();
  });

  it("o botão de filtros mostra e esconde a busca", async () => {
    const { limpar } = montar();
    const botao = screen.getByRole("button", { name: /Filtros/ });
    await userEvent.click(botao);
    expect(botao).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("textbox", { name: "Buscar" })).toBeInTheDocument();
    limpar();
  });
});
