import { mixarEmSegundoPlano, mixarFaixas, type PedidoDeMixagem } from "./mixagem";

const faixa = (taxa: number, ...canais: number[][]) => ({ taxa, canais: canais.map((c) => Float32Array.from(c)) });

describe("mixarFaixas", () => {
  it("soma as faixas amostra por amostra", () => {
    const [esquerda] = mixarFaixas([faixa(10, [0.1, 0.2]), faixa(10, [0.3, 0.1])], 10);
    expect([...esquerda].map((v) => +v.toFixed(2))).toEqual([0.4, 0.3]);
  });

  it("transforma faixas mono em estéreo", () => {
    const [esquerda, direita] = mixarFaixas([faixa(10, [0.5, 0.25])], 10);
    expect([...direita]).toEqual([...esquerda]);
  });

  it("dura o mesmo que a faixa mais longa", () => {
    expect(mixarFaixas([faixa(10, [0.1]), faixa(10, [0.1, 0.1, 0.1])], 10)[0]).toHaveLength(3);
  });

  it("abaixa o volume quando a soma estoura", () => {
    const [esquerda] = mixarFaixas([faixa(10, [0.8, 0.2]), faixa(10, [0.8, 0.2])], 10);
    expect(Math.max(...esquerda)).toBeCloseTo(1);
    expect(esquerda[1]).toBeCloseTo(0.25);
  });

  it("acerta faixas com taxas de amostragem diferentes", () => {
    const [esquerda] = mixarFaixas([faixa(20, [0.1, 0.9, 0.2, 0.9])], 10);
    expect([...esquerda].map((v) => +v.toFixed(2))).toEqual([0.1, 0.2]);
  });
});

describe("mixarEmSegundoPlano", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sem Worker (testes, navegador antigo), mistura na hora com o mesmo resultado", async () => {
    vi.stubGlobal("Worker", undefined);
    const faixas = [faixa(10, [0.1, 0.2]), faixa(10, [0.3, 0.1])];
    expect(await mixarEmSegundoPlano(faixas, 10)).toEqual(mixarFaixas(faixas, 10));
  });

  // A soma das faixas é um laço longo: na thread principal, a tela congelava durante a importação do .sng.
  it("com Worker, manda as faixas para ele (transferindo a memória) e devolve o que ele mistura", async () => {
    const recebidos: { pedido: PedidoDeMixagem; transferidos: Transferable[] }[] = [];
    vi.stubGlobal(
      "Worker",
      class {
        onmessage: ((e: MessageEvent) => void) | null = null;
        postMessage(pedido: PedidoDeMixagem, transferidos: Transferable[]) {
          recebidos.push({ pedido, transferidos });
          setTimeout(() => this.onmessage?.({ data: mixarFaixas(pedido.faixas, pedido.taxa) } as MessageEvent));
        }
        terminate() {}
      },
    );
    const faixas = [faixa(10, [0.1, 0.2])];
    const [esquerda] = await mixarEmSegundoPlano(faixas, 10);
    expect([...esquerda].map((v) => +v.toFixed(2))).toEqual([0.1, 0.2]);
    expect(recebidos[0].transferidos).toHaveLength(1);
  });
});