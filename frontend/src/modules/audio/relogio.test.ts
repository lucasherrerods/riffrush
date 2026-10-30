import { tempoDeSaida, tempoDoEvento, type EstadoDoAudio } from "./relogio";

const tocando = (extra: Partial<EstadoDoAudio> = {}): EstadoDoAudio => ({
  state: "running",
  currentTime: 10,
  outputLatency: 0.05,
  baseLatency: 0.01,
  ...extra,
});

describe("tempoDeSaida", () => {
  it("usa o timestamp de saída e avança com o relógio do sistema", () => {
    const estado = tocando({ timestamp: { contextTime: 9.9, performanceTime: 1000 } });
    expect(tempoDeSaida(estado, 1100)).toBeCloseTo(10);
  });

  // Bug do projeto antigo: usar só o currentTime deixava as notas atrasadas em relação ao som.
  it("desconta a latência de saída quando não há timestamp", () => {
    expect(tempoDeSaida(tocando(), 0)).toBeCloseTo(9.95);
  });

  it("usa a latência base quando a de saída não existe", () => {
    expect(tempoDeSaida(tocando({ outputLatency: 0, baseLatency: 0.02 }), 0)).toBeCloseTo(9.98);
  });

  // Logo depois de voltar da pausa, o timestamp ainda é o de antes dela: somar o tempo do sistema
  // desde então pulava a música para frente, e todas as notas que passaram viravam erro de uma vez.
  it("ignora o timestamp velho que deixaria o tempo longe do áudio de verdade", () => {
    const voltandoDaPausa = tocando({ timestamp: { contextTime: 9.9, performanceTime: 1000 } });
    expect(tempoDeSaida(voltandoDaPausa, 61_000)).toBeCloseTo(9.95);
  });

  it("fica parado enquanto o áudio está suspenso (pausa)", () => {
    const pausado = tocando({ state: "suspended", timestamp: { contextTime: 9.9, performanceTime: 1000 } });
    expect(tempoDeSaida(pausado, 1000)).toBeCloseTo(tempoDeSaida(pausado, 5000));
  });
});

describe("tempoDoEvento", () => {
  // Bug do projeto antigo: o acerto era medido quando o código processava a tecla, não quando ela foi apertada.
  it("volta no tempo o atraso entre o toque e o processamento", () => {
    expect(tempoDoEvento(10, 1000, 970)).toBeCloseTo(9.97);
  });

  it("limita a correção a 100 ms", () => {
    expect(tempoDoEvento(10, 1000, 500)).toBeCloseTo(9.9);
  });

  it("nunca avança para o futuro", () => {
    expect(tempoDoEvento(10, 1000, 1010)).toBe(10);
  });
});
