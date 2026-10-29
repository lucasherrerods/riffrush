import type { Nota } from "@/modules/rock/songs";
import { avancar, criarPartida, quantizar } from "./partida";
import { VERSAO_DO_REPLAY, aplicarEntradas, codigoDaEntrada, entradaDoCodigo, criarGravador, desempacotarReplay, empacotarReplay, hashDoChart, partidaNoInstante, type Replay } from "./replay";

const nota = (tempo: number, pista = 0, duracao = 0): Nota => ({ tempo, pista, duracao, frase: -1 });

const replay: Replay = {
  semFalha: false,
  fantasma: true,
  semAberta: true,
  velocidade: 1.25,
  jeito: "palhetada",
  puneToqueEmVazio: true,
  hashDoChart: "00112233445566778899aabbccddeeff",
  entradas: [
    { tempo: -0.5, tipo: "tocar", pista: 2 },
    { tempo: -0.5, tipo: "soltar", pista: 2 },
    { tempo: 1.001, tipo: "tocar", pista: 4 },
    { tempo: 1.002, tipo: "palhetar", pista: 0 },
    { tempo: 3.25, tipo: "estrela", pista: 0 },
    { tempo: 300.5, tipo: "soltar", pista: 4 },
    { tempo: 301, tipo: "tocar", pista: 5 },
    { tempo: 301.2, tipo: "soltar", pista: 5 },
  ],
};

describe("empacotarReplay", () => {
  it("ida e volta devolve o mesmo replay", async () => {
    expect(await desempacotarReplay(await empacotarReplay(replay))).toEqual(replay);
  });

  it("o primeiro byte é a versão, fora da compressão, para a API conferir", async () => {
    expect((await empacotarReplay(replay))[0]).toBe(VERSAO_DO_REPLAY);
    // Um replay antigo regravado (ao baixar do ranking, por exemplo) continua sem a punição do toque em vazio.
    const semARegra = await desempacotarReplay(await empacotarReplay({ ...replay, puneToqueEmVazio: false }));
    expect(semARegra.puneToqueEmVazio).toBe(false);
  });

  it("continua lendo os replays da versão 1, de antes da nota aberta", async () => {
    // Versão 1: intervalo vezes 11 mais o código. Uma entrada: aperta o verde no tick 0.
    const corpo = new Uint8Array([0, ...new Uint8Array(16), 0, 2, 0, 11 * 5 + 5]);
    const comprimido = new Uint8Array(await new Response(new Response(corpo).body!.pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
    const lido = await desempacotarReplay(new Uint8Array([1, ...comprimido]));
    expect(lido.velocidade).toBe(1);
    // Replays de antes da opção não têm o bit: tocam com a nota aberta.
    expect(lido.semAberta).toBe(false);
    // E todos são do gamepad, o único jeito de jogar que existia.
    expect(lido.jeito).toBe("gamepad");
    // E nenhum pune o toque em vazio: a regra veio na versão 5.
    expect(lido.puneToqueEmVazio).toBe(false);
    expect(lido.entradas).toEqual([
      { tempo: 0, tipo: "tocar", pista: 0 },
      { tempo: 0.005, tipo: "soltar", pista: 0 },
    ]);
  });

  it("os códigos de 0 a 10 não mudaram: a aberta usa 11 (aperta) e 12 (solta)", () => {
    expect(codigoDaEntrada({ tempo: 0, tipo: "tocar", pista: 4 })).toBe(4);
    expect(codigoDaEntrada({ tempo: 0, tipo: "soltar", pista: 4 })).toBe(9);
    expect(codigoDaEntrada({ tempo: 0, tipo: "estrela", pista: 0 })).toBe(10);
    expect(codigoDaEntrada({ tempo: 0, tipo: "tocar", pista: 5 })).toBe(11);
    expect(codigoDaEntrada({ tempo: 0, tipo: "soltar", pista: 5 })).toBe(12);
    expect(entradaDoCodigo(0, 12)).toEqual({ tempo: 0, tipo: "soltar", pista: 5 });
    expect(codigoDaEntrada({ tempo: 0, tipo: "palhetar", pista: 0 })).toBe(13);
    expect(entradaDoCodigo(0, 13)).toEqual({ tempo: 0, tipo: "palhetar", pista: 0 });
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

  it("o toque que leva à derrota fica gravado no tempo do toque, e o replay dá a mesma derrota", () => {
    // Vida inicial 0,5 e 0,03 por erro: 17 notas perdidas zeram a vida.
    const muitas = Array.from({ length: 20 }, (_, i) => nota(1 + i * 0.2, 0));
    const aoVivo = criarPartida(muitas);
    const gravador = criarGravador(aoVivo);
    gravador.tocar(1, 6);
    expect(aoVivo.derrota).toBe(true);
    expect(gravador.entradas).toEqual([{ tempo: 6, tipo: "tocar", pista: 1 }]);
    // Depois da derrota nada mais conta: não grava.
    gravador.tocar(0, 7);
    expect(gravador.entradas).toHaveLength(1);

    const reproduzida = criarPartida(muitas);
    aplicarEntradas(reproduzida, gravador.entradas, 0, Infinity, []);
    avancar(reproduzida, 10);
    expect([reproduzida.derrota, reproduzida.erros, reproduzida.acertos]).toEqual([aoVivo.derrota, aoVivo.erros, aoVivo.acertos]);
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

describe("partidaNoInstante", () => {
  const notas = [nota(1), nota(2, 1), nota(3, 2), nota(4, 3)];
  const opcoes = { semFalha: false, fantasma: false, semAberta: false, velocidade: 1, jeito: "tapping" as const, puneToqueEmVazio: true };
  const entradas = [
    { tempo: 1, tipo: "tocar" as const, pista: 0 },
    { tempo: 1.05, tipo: "soltar" as const, pista: 0 },
    { tempo: 2, tipo: "tocar" as const, pista: 1 },
    { tempo: 3, tipo: "tocar" as const, pista: 2 },
  ];

  it("chega ao mesmo estado de tocar o replay do começo até ali", () => {
    const tocada = criarPartida(notas, opcoes);
    const apertados: boolean[] = [];
    let indice = 0;
    for (let t = -1; t <= 2.5; t += 0.016) {
      indice = aplicarEntradas(tocada, entradas, indice, t, apertados);
      avancar(tocada, t);
    }
    indice = aplicarEntradas(tocada, entradas, indice, 2.5, apertados);
    avancar(tocada, 2.5);
    const pulada = partidaNoInstante(notas, opcoes, entradas, 2.5);
    expect(pulada.partida.pontos).toBe(tocada.pontos);
    expect(pulada.partida.acertos).toBe(2);
    expect(pulada.proximaEntrada).toBe(indice);
    expect(pulada.apertados[1]).toBe(true);
    expect(pulada.apertados[0]).toBe(false);
  });

  it("voltar no tempo refaz a partida sem os acertos de depois", () => {
    const depois = partidaNoInstante(notas, opcoes, entradas, 3.5);
    const antes = partidaNoInstante(notas, opcoes, entradas, 1.5);
    expect(depois.partida.acertos).toBe(3);
    expect(antes.partida.acertos).toBe(1);
    expect(antes.partida.notas[2].acertada).toBe(false);
  });

  it("não deixa eventos para trás: os efeitos do que já passou não tocam ao pular", () => {
    expect(partidaNoInstante(notas, opcoes, entradas, 3.5).partida.eventos).toEqual([]);
  });
});
