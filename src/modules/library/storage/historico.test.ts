import { MUSICAS_EMBUTIDAS, type Musica } from "@/modules/songs";
import { juntarMusicas, semAudio } from "./historico";

const [embutida] = MUSICAS_EMBUTIDAS;
const arquivo = new File(["x"], "a.mp3");
const importada = (id: string, comArquivo = true): Musica => ({ ...embutida, id, titulo: id, arquivo: comArquivo ? arquivo : undefined });

describe("juntarMusicas", () => {
  it("acrescenta as músicas novas no fim", () => {
    expect(juntarMusicas([embutida], [importada("arquivo:a")]).map((m) => m.id)).toEqual([embutida.id, "arquivo:a"]);
  });

  // Bug evitado: importar de novo uma música do histórico era ignorado, e ela continuava sem áudio.
  it("troca a música que já está na lista, no mesmo lugar", () => {
    const juntas = juntarMusicas([importada("arquivo:a", false), embutida], [importada("arquivo:a")]);
    expect(juntas.map((m) => m.id)).toEqual(["arquivo:a", embutida.id]);
    expect(juntas[0].arquivo).toBe(arquivo);
  });
});

describe("semAudio", () => {
  it("só a música importada que perdeu o arquivo está sem áudio", () => {
    expect(semAudio(importada("arquivo:a", false))).toBe(true);
    expect(semAudio(importada("arquivo:a"))).toBe(false);
    expect(semAudio(embutida)).toBe(false);
  });

  it("no PC, a música guardada no aparelho tem áudio mesmo sem o arquivo carregado", () => {
    expect(semAudio({ ...importada("arquivo:a", false), noAparelho: true })).toBe(false);
  });
});
