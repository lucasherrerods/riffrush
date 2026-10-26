import { render, screen, within } from "@testing-library/react";
import { App } from "./App";
import { LINKS } from "./links";

beforeAll(() => {
  // O jsdom não tem canvas nem IntersectionObserver; a demo e as animações só precisam existir.
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

  it("tem uma demo jogável com as teclas do jogo", () => {
    render(<App />);
    const demo = screen.getByRole("region", { name: /demo/i });
    ["A", "S", "J", "K", "L"].forEach((tecla) => expect(within(demo).getByRole("button", { name: new RegExp(`tecla ${tecla}`, "i") })).toBeInTheDocument());
  });

  it("mostra os direitos autorais", () => {
    render(<App />);
    expect(screen.getByText(/© 2026 Riff Rush/)).toBeInTheDocument();
  });
});
