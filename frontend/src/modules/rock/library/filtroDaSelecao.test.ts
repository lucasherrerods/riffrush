import type { Musica } from "@/modules/rock/songs";
import { filtrarMusicas } from "./filtroDaSelecao";

const musica = (id: string, titulo: string, artista: string, genero = "Rock") => ({ id, titulo, artista, genero }) as Musica;
const musicas = [musica("a", "Zebra", "Banda B"), musica("b", "Ária", "Banda A", "Metal"), musica("c", "Meio", "Outra")];
const base = { texto: "", ordem: "biblioteca" as const, favoritas: new Set<string>(), soFavoritas: false };

describe("filtrarMusicas", () => {
  it("sem filtro, mantém a ordem da biblioteca", () => {
    expect(filtrarMusicas(musicas, base)).toEqual([0, 1, 2]);
  });

  it("busca sem acento por título, artista ou gênero", () => {
    expect(filtrarMusicas(musicas, { ...base, texto: "aria" })).toEqual([1]);
    expect(filtrarMusicas(musicas, { ...base, texto: "metal" })).toEqual([1]);
    expect(filtrarMusicas(musicas, { ...base, texto: "banda" })).toEqual([0, 1]);
  });

  it("ordena por título ou artista", () => {
    expect(filtrarMusicas(musicas, { ...base, ordem: "titulo" })).toEqual([1, 2, 0]);
    expect(filtrarMusicas(musicas, { ...base, ordem: "artista" })).toEqual([1, 0, 2]);
  });

  it("só as favoritas com o filtro ligado", () => {
    expect(filtrarMusicas(musicas, { ...base, favoritas: new Set(["c"]), soFavoritas: true })).toEqual([2]);
  });
});
