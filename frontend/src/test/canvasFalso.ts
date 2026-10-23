export interface Chamada {
  metodo: string;
  args: unknown[];
}

/** Contexto 2D de mentira: aceita qualquer chamada e anota tudo para o teste conferir. */
export function criarCanvasFalso() {
  const chamadas: Chamada[] = [];
  const estado: Record<string | symbol, unknown> = {};
  const contexto = new Proxy(estado, {
    get(alvo, nome) {
      if (nome in alvo) return alvo[nome];
      return (...args: unknown[]) => {
        chamadas.push({ metodo: String(nome), args });
        if (nome === "createLinearGradient" || nome === "createRadialGradient") return { addColorStop() {} };
      };
    },
    set(alvo, nome, valor) {
      chamadas.push({ metodo: `=${String(nome)}`, args: [valor] });
      alvo[nome] = valor;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { contexto, chamadas, desenhos: () => chamadas.filter((c) => c.metodo === "drawImage").map((c) => c.args[0]) };
}
