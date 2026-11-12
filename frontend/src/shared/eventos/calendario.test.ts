import { escolherEvento, eventoDoDia, estaNoPeriodo } from "./calendario";

const dia = (ano: number, mes: number, d: number) => new Date(ano, mes - 1, d, 12);

describe("estaNoPeriodo", () => {
  const natal = { inicio: { mes: 12, dia: 1 }, fim: { mes: 1, dia: 6 } };

  it("vale dentro do período que atravessa a virada do ano", () => {
    expect(estaNoPeriodo(dia(2026, 12, 1), natal)).toBe(true);
    expect(estaNoPeriodo(dia(2026, 12, 31), natal)).toBe(true);
    expect(estaNoPeriodo(dia(2027, 1, 6), natal)).toBe(true);
  });

  it("não vale fora dele", () => {
    expect(estaNoPeriodo(dia(2026, 11, 30), natal)).toBe(false);
    expect(estaNoPeriodo(dia(2027, 1, 7), natal)).toBe(false);
    expect(estaNoPeriodo(dia(2026, 7, 15), natal)).toBe(false);
  });

  it("funciona com período dentro do mesmo ano", () => {
    const junina = { inicio: { mes: 6, dia: 1 }, fim: { mes: 6, dia: 30 } };
    expect(estaNoPeriodo(dia(2026, 6, 15), junina)).toBe(true);
    expect(estaNoPeriodo(dia(2026, 7, 1), junina)).toBe(false);
  });
});

describe("eventoDoDia", () => {
  it("acha o Natal de novembro até 1º de janeiro", () => {
    expect(eventoDoDia(dia(2026, 10, 31))).toBeUndefined();
    expect(eventoDoDia(dia(2026, 11, 1))?.id).toBe("natal");
    expect(eventoDoDia(dia(2026, 12, 24))?.id).toBe("natal");
    expect(eventoDoDia(dia(2027, 1, 1))?.id).toBe("natal");
    expect(eventoDoDia(dia(2027, 1, 2))).toBeUndefined();
  });

  it("não acha nada num dia comum", () => {
    expect(eventoDoDia(dia(2026, 8, 10))).toBeUndefined();
  });
});

describe("escolherEvento", () => {
  it("segue o calendário sem pedido de fora", () => {
    expect(escolherEvento(dia(2026, 12, 24), null)?.id).toBe("natal");
  });

  it("o pedido força um evento fora do período, para testar o visual", () => {
    expect(escolherEvento(dia(2026, 8, 10), "natal")?.id).toBe("natal");
  });

  it("o pedido 'nenhum' desliga o evento do calendário", () => {
    expect(escolherEvento(dia(2026, 12, 24), "nenhum")).toBeUndefined();
  });

  it("ignora um pedido desconhecido e segue o calendário", () => {
    expect(escolherEvento(dia(2026, 12, 24), "carnaval-falso")?.id).toBe("natal");
  });
});
