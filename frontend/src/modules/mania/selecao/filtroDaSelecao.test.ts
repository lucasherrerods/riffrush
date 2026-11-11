import type { ConjuntoSalvo, DificuldadeSalva } from "../beatmaps/biblioteca";
import { filtrarConjuntos, maiorEstrela, teclasDaBiblioteca } from "./filtroDaSelecao";

const mapa = (hash: string, teclas: number, dificuldade = "Hard"): DificuldadeSalva => ({
  hash,
  dificuldade,
  teclas,
  od: 8,
  hp: 8,
  notas: 100,
  notasLongas: 10,
  duracaoMs: 60_000,
  previaMs: 0,
  arquivoDeAudio: "a.mp3",
});

const conjunto = (id: string, titulo: string, artista: string, mapas: DificuldadeSalva[], extra: Partial<ConjuntoSalvo> = {}): ConjuntoSalvo =>
  ({ id, titulo, artista, mapper: "fulano", origem: "osu", mapas, usadoEm: 0, ...extra }) as ConjuntoSalvo;

const a = conjunto("a", "Zebra", "Banda B", [mapa("a1", 4), mapa("a2", 7, "Insane")], { estrelas: { a1: 2, a2: 5.5 } });
const b = conjunto("b", "Abelha", "Cantora C", [mapa("b1", 4)], { mapper: "ciclano", estrelas: { b1: 3 } });
const c = conjunto("c", "Meio", "Artista A", [mapa("c1", 7)]);
const todos = [a, b, c];

describe("filtrarConjuntos", () => {
  it("sem filtro, mantém a ordem da biblioteca (os recentes primeiro)", () => {
    expect(filtrarConjuntos(todos, { texto: "", teclas: "todas", ordem: "recentes" }).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("busca no título, artista, mapper e nome da dificuldade, sem ligar para acento e caixa", () => {
    const ids = (texto: string) => filtrarConjuntos(todos, { texto, teclas: "todas", ordem: "recentes" }).map((x) => x.id);
    expect(ids("abélha")).toEqual(["b"]);
    expect(ids("artista")).toEqual(["c"]);
    expect(ids("CICLANO")).toEqual(["b"]);
    expect(ids("insane")).toEqual(["a"]);
  });

  it("filtra pelas teclas e tira do conjunto as dificuldades de outras teclas", () => {
    const so7 = filtrarConjuntos(todos, { texto: "", teclas: 7, ordem: "recentes" });
    expect(so7.map((x) => x.id)).toEqual(["a", "c"]);
    expect(so7[0].mapas.map((m) => m.hash)).toEqual(["a2"]);
  });

  it("ordena por título, artista e estrelas", () => {
    const ordem = (o: "titulo" | "artista" | "estrelas") => filtrarConjuntos(todos, { texto: "", teclas: "todas", ordem: o }).map((x) => x.id);
    expect(ordem("titulo")).toEqual(["b", "c", "a"]);
    expect(ordem("artista")).toEqual(["c", "a", "b"]);
    expect(ordem("estrelas")).toEqual(["a", "b", "c"]);
  });
});

it("maiorEstrela pega a dificuldade mais difícil, e nada sem estrelas", () => {
  expect(maiorEstrela(a)).toBe(5.5);
  expect(maiorEstrela(c)).toBeUndefined();
});

it("teclasDaBiblioteca lista as teclas que existem, em ordem", () => {
  expect(teclasDaBiblioteca(todos)).toEqual([4, 7]);
});

it("teclasDaBiblioteca só oferece de 4K a 7K, para os filtros caberem numa linha", () => {
  const largos = conjunto("d", "Largo", "Artista D", [mapa("d1", 1), mapa("d2", 5), mapa("d3", 8), mapa("d4", 10)]);
  expect(teclasDaBiblioteca([...todos, largos])).toEqual([4, 5, 7]);
});
