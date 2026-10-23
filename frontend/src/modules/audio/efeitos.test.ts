import { AudioContextFalso, comAudioFalso } from "@/test/audioFalso";

const importar = () => comAudioFalso(() => import("./efeitos"));
const contexto = () => AudioContextFalso.instancias[0];

describe("tocarEfeito", () => {
  it("não toca nada com volume zero", async () => {
    const { tocarEfeito } = await importar();
    tocarEfeito("selecionar", 0);
    expect(contexto()?.osciladores ?? []).toHaveLength(0);
  });

  it("toca com a forma de onda e o glissando do preset", async () => {
    const { tocarEfeito, EFEITOS } = await importar();
    tocarEfeito("selecionar", 1);
    const [oscilador] = contexto().osciladores;
    expect(oscilador.type).toBe(EFEITOS.selecionar.onda);
    expect(oscilador.frequency.eventos[0].valor).toBe(EFEITOS.selecionar.de);
    expect(oscilador.frequency.eventos[1].valor).toBe(EFEITOS.selecionar.para);
  });

  it("escala o volume do preset pelo volume pedido", async () => {
    const { tocarEfeito, EFEITOS } = await importar();
    tocarEfeito("erro", 0.5);
    expect(contexto().ganhos[0].gain.eventos[0].valor).toBeCloseTo(EFEITOS.erro.volume * 0.5);
  });

  it("para o oscilador logo depois do fim do efeito", async () => {
    const { tocarEfeito, EFEITOS } = await importar();
    tocarEfeito("estrela", 1);
    const [oscilador] = contexto().osciladores;
    expect(oscilador.fim).toBeGreaterThan(EFEITOS.estrela.duracao);
    expect(oscilador.fim).toBeLessThan(EFEITOS.estrela.duracao + 0.1);
  });

  it("todos os efeitos têm duração positiva", async () => {
    const { EFEITOS } = await importar();
    for (const efeito of Object.values(EFEITOS)) expect(efeito.duracao).toBeGreaterThan(0);
  });
});
