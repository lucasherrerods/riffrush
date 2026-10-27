import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { InfoDoBeatmap, MotorDoMania, hashDoBeatmap, iniciarMotorDoManiaComBytes } from "./motor";

/** Os mesmos casos que o motor em Rust confere em `backend/motor-mania/tests/paridade.rs`. */
const casos: {
  nome: string;
  mapa: string;
  mods: number;
  semente: number;
  entradas: [number, number, number][];
  fim_ms: number;
  esperado: unknown;
}[] = JSON.parse(readFileSync(resolve(process.cwd(), "../backend/motor-mania/tests/paridade.json"), "utf8"));

beforeAll(() => iniciarMotorDoManiaComBytes(readFileSync(resolve(process.cwd(), "src/modules/mania/gameplay/wasm/motor_bg.wasm"))));

describe("paridade com o motor da API", () => {
  it.each(casos.map((c) => [c.nome, c] as const))("%s dá o resultado gravado", (_, caso) => {
    const motor = new MotorDoMania(caso.mapa, caso.mods, caso.semente);
    for (const [tempo, coluna, toca] of caso.entradas) {
      if (toca === 1) motor.tocar(coluna, tempo);
      else motor.soltar(coluna, tempo);
    }
    motor.avancar(caso.fim_ms);
    expect({
      contagem: [...motor.contagem()],
      pontuacao: motor.pontuacao(),
      precisao: Math.round(motor.precisao() * 1e6),
      maior_combo: motor.maiorCombo,
      derrota: motor.derrota,
    }).toEqual(caso.esperado);
    motor.free();
  });
});

describe("leitura do .osu", () => {
  it("devolve os dados do mapa para a biblioteca", () => {
    const info = new InfoDoBeatmap(casos[0].mapa);
    expect([info.titulo, info.dificuldade, info.teclas, info.od, info.notas, info.notasLongas]).toEqual(["Paridade", "4K", 4, 7, 8, 2]);
    expect(info.duracaoMs).toBe(3600);
    info.free();
  });

  it("recusa o que não é mania com uma mensagem clara", () => {
    expect(() => new InfoDoBeatmap(casos[0].mapa.replace("Mode: 3", "Mode: 1"))).toThrow("outro modo do osu!");
  });

  it("o hash é o md5 do arquivo, como no osu!", () => {
    expect(hashDoBeatmap(new TextEncoder().encode("osu"))).toBe("a0485de5d3213f4bc5c38e2d302bd169");
  });
});
