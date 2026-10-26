import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hashDoChart } from "@/modules/gameplay";
import { escolherTrilha, lerChart, lerMidi, lerSng } from "./cloneHero";
import type { Dificuldade, Instrumento, Nota } from "./tipos";

/** Os mesmos .sng que o motor em Rust da API confere em `backend/motor/tests/charts.rs`. */
const casos: { sng: string; trilhas: Record<string, string>; notas: Record<string, Nota[]> }[] = JSON.parse(
  readFileSync(resolve(process.cwd(), "../backend/motor/tests/charts.json"), "utf8"),
);

describe("paridade dos charts com o motor da API", () => {
  casos.forEach((caso, i) =>
    it(`o .sng ${i} dá as mesmas notas e o mesmo hash em cada trilha`, async () => {
      const pacote = lerSng(Uint8Array.from(Buffer.from(caso.sng, "base64")).buffer);
      const texto = pacote.arquivos.get("notes.chart");
      const chart = texto ? lerChart(new TextDecoder().decode(texto)) : lerMidi(pacote.arquivos.get("notes.mid")!);
      const atraso = (Number(pacote.metadados.delay) || 0) / 1000;
      for (const [trilha, hash] of Object.entries(caso.trilhas)) {
        const [instrumento, dificuldade] = trilha.split(":") as [Instrumento, Dificuldade];
        const notas = escolherTrilha(chart, instrumento, dificuldade).map((n) => ({ tempo: n.tempo - atraso, pista: n.pista, frase: n.frase, duracao: n.duracao }));
        expect(notas).toEqual(caso.notas[hash]);
        expect(await hashDoChart(notas)).toBe(hash);
      }
    }),
  );
});
