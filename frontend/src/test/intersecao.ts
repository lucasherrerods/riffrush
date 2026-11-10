import { act } from "@testing-library/react";

/** Os observadores criados na tela, para os testes fingirem que a lista rolou até o fim. */
const observadores = new Set<{ chamar: IntersectionObserverCallback; alvos: Set<Element>; eu: IntersectionObserver }>();

export class IntersectionObserverFalso {
  private registro;
  constructor(chamar: IntersectionObserverCallback) {
    this.registro = { chamar, alvos: new Set<Element>(), eu: this as unknown as IntersectionObserver };
    observadores.add(this.registro);
  }
  observe(alvo: Element) {
    this.registro.alvos.add(alvo);
  }
  unobserve(alvo: Element) {
    this.registro.alvos.delete(alvo);
  }
  disconnect() {
    observadores.delete(this.registro);
  }
  takeRecords() {
    return [];
  }
}

/** Faz cada elemento observado aparecer na tela, como quando o jogador rola até o fim da lista. */
export function rolarAteOFim() {
  act(() => {
    for (const { chamar, alvos, eu } of [...observadores]) {
      const entradas = [...alvos].map((target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry);
      if (entradas.length) chamar(entradas, eu);
    }
  });
}
