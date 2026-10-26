import type { MusicaNoRanking } from "./api";
import { filtrarMusicas } from "./filtros";

const musica = (musica_id: string, partidas: number, jogadores: number, extra: Partial<MusicaNoRanking> = {}): MusicaNoRanking => ({ posicao: 0, musica_id, partidas, jogadores, ...extra });

const musicas = [
  musica("a", 30, 2, { titulo: "Shine", artista: "Spektrem" }),
  musica("b", 10, 6, { titulo: "Barracuda", artista: "Heart", recorde: { nome: "Ana", pontos: 900, precisao: 0.9, dificuldade: "expert" } }),
  musica("c", 5, 3, { titulo: "Ação", artista: "Banda", recorde: { nome: "Bia", pontos: 990, precisao: 0.99, dificuldade: "medio" } }),
];
const nome = (m: MusicaNoRanking) => `${m.titulo} — ${m.artista}`;
const ids = (lista: MusicaNoRanking[]) => lista.map((m) => m.musica_id);

describe("filtrarMusicas", () => {
  it("sem busca, mantém a ordem de mais partidas", () => {
    expect(ids(filtrarMusicas(musicas, { busca: "", ordem: "partidas" }, nome))).toEqual(["a", "b", "c"]);
  });

  it("busca pelo nome ou pela banda, sem ligar para maiúsculas e acentos", () => {
    expect(ids(filtrarMusicas(musicas, { busca: "HEART", ordem: "partidas" }, nome))).toEqual(["b"]);
    expect(ids(filtrarMusicas(musicas, { busca: "acao", ordem: "partidas" }, nome))).toEqual(["c"]);
    expect(filtrarMusicas(musicas, { busca: "nada disso", ordem: "partidas" }, nome)).toEqual([]);
  });

  it("ordena por jogadores, pelo nome ou pela precisão do recorde, com quem não tem recorde no fim", () => {
    expect(ids(filtrarMusicas(musicas, { busca: "", ordem: "jogadores" }, nome))).toEqual(["b", "c", "a"]);
    expect(ids(filtrarMusicas(musicas, { busca: "", ordem: "nome" }, nome))).toEqual(["c", "b", "a"]);
    expect(ids(filtrarMusicas(musicas, { busca: "", ordem: "recorde" }, nome))).toEqual(["c", "b", "a"]);
  });

  it("não mexe na lista recebida", () => {
    const copia = [...musicas];
    filtrarMusicas(musicas, { busca: "", ordem: "nome" }, nome);
    expect(musicas).toEqual(copia);
  });
});
