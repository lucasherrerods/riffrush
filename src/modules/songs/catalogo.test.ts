import { MUSICAS_EMBUTIDAS } from "./catalogo";
import { chartDaMelodia } from "./chart";
import { compor } from "./composicao";

describe("MUSICAS_EMBUTIDAS", () => {
  it("têm ids únicos", () => {
    const ids = MUSICAS_EMBUTIDAS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("têm estilo, semente e o mesmo bpm do estilo", () => {
    for (const musica of MUSICAS_EMBUTIDAS) {
      expect(musica.estilo).toBeDefined();
      expect(musica.semente).toBeDefined();
      expect(musica.bpm).toBe(musica.estilo!.bpm);
    }
  });

  // Bug do projeto antigo: o expert tinha poucas notas e ficava sem graça.
  it.each(MUSICAS_EMBUTIDAS)("$titulo tem pelo menos 3 notas por segundo no expert", (musica) => {
    const { melodia } = compor(musica.estilo!, musica.semente!);
    const notas = chartDaMelodia(melodia, "expert", 60 / musica.bpm);
    const duracaoDaMelodia = melodia[melodia.length - 1].tempo - melodia[0].tempo;
    expect(notas.length / duracaoDaMelodia).toBeGreaterThanOrEqual(3);
  });
});
