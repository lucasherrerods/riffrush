import { act, render } from "@testing-library/react";
import { ShowAoVivo } from "./ShowAoVivo";
import type { EstadoDoPalco } from "./cena";

const estado = (parcial: Partial<EstadoDoPalco> = {}) =>
  ({ tocando: true, bpm: 120, pulso: 0, triste: false, tempo: 10, entrada: 3, estrelaAtiva: false, desdeTrovao: Infinity, sequencia: 0, multiplicador: 1, apagando: false, ...parcial }) as EstadoDoPalco;

const quadro = () => act(() => vi.advanceTimersByTime(20));

describe("ShowAoVivo", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("é só decoração: não recebe toques nem aparece nos leitores de tela", () => {
    const { container } = render(<ShowAoVivo lerEstado={() => estado()} />);
    const raiz = container.querySelector("[data-parte='show-ao-vivo']");
    expect(raiz).toHaveAttribute("aria-hidden", "true");
    expect(raiz).toHaveClass("pointer-events-none");
  });

  it("acompanha a partida: pulsa na sequência longa, solta flashes no multiplicador máximo e muda a paleta no star power", () => {
    let atual = estado();
    const { container } = render(<ShowAoVivo lerEstado={() => atual} />);
    const raiz = container.querySelector<HTMLElement>("[data-parte='show-ao-vivo']")!;
    quadro();
    expect(raiz.dataset.pulsando).toBe("false");
    expect(raiz.dataset.flashes).toBe("false");

    atual = estado({ sequencia: 60, multiplicador: 4, estrelaAtiva: true });
    quadro();
    expect(raiz.dataset.pulsando).toBe("true");
    expect(raiz.dataset.flashes).toBe("true");
    expect(raiz.dataset.paleta).toBe("estrela");

    atual = estado({ sequencia: 60, multiplicador: 4, apagando: true });
    quadro();
    expect(raiz.dataset.flashes).toBe("false");
    expect(raiz.style.getPropertyValue("--luz")).toBe("0.15");
  });
});
