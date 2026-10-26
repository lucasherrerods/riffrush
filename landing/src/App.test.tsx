import { render, screen, within } from "@testing-library/react";
import { App } from "./App";
import { LINKS } from "./links";

beforeAll(() => {
  // O jsdom não tem canvas nem IntersectionObserver; a pista e as animações só precisam existir.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as never;
});

describe("App", () => {
  it("leva para jogar no navegador e para baixar o jogo logo no topo", () => {
    render(<App />);
    const topo = screen.getByRole("main");
    expect(within(topo).getAllByRole("link", { name: /jogar no navegador/i })[0]).toHaveAttribute("href", LINKS.jogarNoNavegador);
    expect(within(topo).getAllByRole("link", { name: /baixar/i })[0]).toHaveAttribute("href", LINKS.baixar);
  });

  it("aponta o GitHub para o repositório do projeto", () => {
    render(<App />);
    screen.getAllByRole("link", { name: /github/i }).forEach((link) => expect(link).toHaveAttribute("href", LINKS.github));
  });

  it("mostra os três jeitos de tocar", () => {
    render(<App />);
    ["Teclado", "Controle", "Celular"].forEach((instrumento) => expect(screen.getByText(instrumento)).toBeInTheDocument());
  });

  it("leva do rodapé para as seções da página", () => {
    render(<App />);
    const rodape = screen.getByRole("navigation", { name: /rodapé/i });
    expect(within(rodape).getByRole("link", { name: "Recursos" })).toHaveAttribute("href", "#recursos");
  });

  it("apresenta a equipe com a foto de cada integrante", () => {
    render(<App />);
    ["Lucas", "Felipe", "Vitor"].forEach((nome) => expect(screen.getAllByRole("img", { name: `Retrato de ${nome}` }).length).toBeGreaterThan(0));
  });

  it("mostra os direitos autorais", () => {
    render(<App />);
    expect(screen.getByText(/© 2026 Riff Rush/)).toBeInTheDocument();
  });
});
