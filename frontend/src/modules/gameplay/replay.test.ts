import type { Nota } from "@/modules/songs";
import { avancar, criarPartida, quantizar } from "./partida";
import { VERSAO_DO_REPLAY, aplicarEntradas, criarGravador, desempacotarReplay, empacotarReplay, hashDoChart, type Replay } from "./replay";

const nota = (tempo: number, pista = 0, duracao = 0): Nota => ({ tempo, pista, duracao, frase: -1 });

const replay: Replay = {
  semFalha: false,
  fantasma: true,
  hashDoChart: "00112233445566778899aabbccddeeff",
  entradas: [
    { tempo: -0.5, tipo: "tocar", pista: 2 },
    { tempo: -0.5, tipo: "soltar", pista: 2 },
    { tempo: 1.001, tipo: "tocar", pista: 4 },
    { tempo: 3.25, tipo: "estrela", pista: 0 },
    { tempo: 300.5, tipo: "soltar", pista: 4 },
  ],
};

describe("empacotarReplay", () => {
  it("ida e volta devolve o mesmo replay", async () => {
    expect(await desempacotarReplay(await empacotarReplay(replay))).toEqual(replay);
  });

  it("o primeiro byte é a versão, fora da compressão, para a API conferir", async () => {
    expect((await empacotarReplay(replay))[0]).toBe(VERSAO_DO_REPLAY);
  });

  it("recusa versão desconhecida", async () => {
    const bytes = await empacotarReplay(replay);
    bytes[0] = 99;
    await expect(desempacotarReplay(bytes)).rejects.toThrow("versão");
  });

  it("uma música difícil inteira fica com poucos KB", async () => {
    // 3.000 notas apertadas e soltas, uma a cada ~70 ms, com a imprecisão de uma pessoa: 6.000 entradas.
    let semente = 7;
    const aleatorio = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
    const entradas = Array.from({ length: 3000 }, (_, i) => {
      const tempo = 1 + i * 0.07 + (aleatorio() - 0.5) * 0.06;
      const pista = Math.floor(aleatorio() * 5);
      return [
        { tempo: quantizar(tempo), tipo: "tocar" as const, pista },
        { tempo: quantizar(tempo + 0.02 + aleatorio() * 0.04), tipo: "soltar" as const, pista },
      ];
    })
      .flat()
      .sort((a, b) => a.tempo - b.tempo);
    const bytes = await empacotarReplay({ ...replay, entradas });
    expect(bytes.length).toBeLessThan(10 * 1024);
  });
});

describe("hashDoChart", () => {
  it("o mesmo chart dá o mesmo hash, e qualquer nota diferente muda o hash", async () => {
    const chart = [nota(1, 0), nota(2, 3, 0.5)];
    expect(await hashDoChart(chart)).toMatch(/^[0-9a-f]{32}$/);
    expect(await hashDoChart([...chart])).toBe(await hashDoChart(chart));
    expect(await hashDoChart([nota(1, 0), nota(2, 4, 0.5)])).not.toBe(await hashDoChart(chart));
  });
});

describe("gravar e reproduzir", () => {
  const chart = [nota(1, 0), nota(1.5, 1, 1), nota(2, 2), nota(4, 3), nota(4.2, 3)];

  it("reproduzir as entradas gravadas dá a mesma pontuação, em outra taxa de frames", () => {
    const aoVivo = criarPartida(chart);
    const gravador = criarGravador(aoVivo);
    gravador.tocar(0, 1.01);
    gravador.soltar(0, 1.05);
    gravador.tocar(1, 1.49);
    avancar(aoVivo, 2.1);
    gravador.soltar(1, 2.3);
    gravador.tocar(3, 4.02);
    gravador.soltar(3, 4.15);
    avancar(aoVivo, 6);

    const reproduzida = criarPartida(chart);
    const apertados = [false, false, false, false, false];
    let indice = 0;
    for (let t = 0; t <= 6; t += 1 / 37) {
      indice = aplicarEntradas(reproduzida, gravador.entradas, indice, t, apertados);
      avancar(reproduzida, t);
    }
    indice = aplicarEntradas(reproduzida, gravador.entradas, indice, 6, apertados);
    avancar(reproduzida, 6);

    expect(indice).toBe(gravador.entradas.length);
    expect(reproduzida.pontos).toBe(aoVivo.pontos);
    expect(reproduzida.acertos).toBe(aoVivo.acertos);
    expect(reproduzida.acertos).toBe(4);
  });

  it("grava o tempo que a partida usou, e não o que veio da entrada", () => {
    const partida = criarPartida(chart);
    avancar(partida, 1.2);
    const gravador = criarGravador(partida);
    gravador.tocar(0, 1.123456);
    expect(gravador.entradas).toEqual([{ tempo: 1.2, tipo: "tocar", pista: 0 }]);
  });

  it("só grava o star power quando ele ativa de fato", () => {
    const gravador = criarGravador(criarPartida(chart));
    expect(gravador.ativarEstrela()).toBe(false);
    expect(gravador.entradas).toEqual([]);
  });

  it("aplicar as entradas aperta e solta os trastes do replay", () => {
    const partida = criarPartida(chart);
    const apertados = [false, false, false, false, false];
    aplicarEntradas(partida, [{ tempo: 1, tipo: "tocar", pista: 0 }], 0, 1, apertados);
    expect(apertados[0]).toBe(true);
    aplicarEntradas(partida, [{ tempo: 1.1, tipo: "soltar", pista: 0 }], 0, 1.1, apertados);
    expect(apertados[0]).toBe(false);
  });
});
