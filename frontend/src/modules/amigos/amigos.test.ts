import type { PessoaOnline } from "@/modules/presenca";
import type { PessoaDaAmizade } from "./api";
import { convitePodeSair, filtrarPorNome, pedidosNovos, separarPorPresenca, vistoHa } from "./amigos";

const amigo = (conta_id: string, nome: string, visto_em: string | null = null): PessoaDaAmizade => ({ conta_id, nome, avatar: null, nivel: 1, visto_em, desde: "2026-10-01T00:00:00Z" });
const online = (id: string, estado: PessoaOnline["estado"] = { tipo: "menu" }): PessoaOnline => ({ id, nome: "?", avatar: null, estado });

describe("separarPorPresenca", () => {
  it("põe online quem está na presença, com o estado, e o resto offline pelo visto mais recente", () => {
    const amigos = [amigo("a", "Beto", "2026-10-29T00:00:00Z"), amigo("b", "Ana"), amigo("c", "Caio", "2026-10-30T00:00:00Z"), amigo("d", "Duda")];
    const { online: on, offline } = separarPorPresenca(amigos, [online("b", { tipo: "selecao" }), online("d"), online("z")]);
    expect(on.map((a) => [a.nome, a.estado.tipo])).toEqual([
      ["Ana", "selecao"],
      ["Duda", "menu"],
    ]);
    expect(offline.map((a) => a.nome)).toEqual(["Caio", "Beto"]);
  });
});

describe("filtrarPorNome", () => {
  it("ignora maiúsculas e acentos", () => {
    const lista = [amigo("a", "JúliaRock"), amigo("b", "MetalLucas")];
    expect(filtrarPorNome(lista, " julia ").map((a) => a.nome)).toEqual(["JúliaRock"]);
    expect(filtrarPorNome(lista, "")).toHaveLength(2);
  });
});

describe("vistoHa", () => {
  const agora = new Date("2026-10-30T12:00:00Z");
  it.each([
    [null, "Offline"],
    ["2026-10-30T11:59:30Z", "Visto agora"],
    ["2026-10-30T11:45:00Z", "Visto há 15 min"],
    ["2026-10-30T10:00:00Z", "Visto há 2 horas"],
    ["2026-10-30T11:00:00Z", "Visto há 1 hora"],
    ["2026-10-29T09:00:00Z", "Visto ontem"],
    ["2026-10-27T12:00:00Z", "Visto há 3 dias"],
    ["2026-10-22T12:00:00Z", "Visto há 1 semana"],
    ["2026-10-09T12:00:00Z", "Visto há 3 semanas"],
    ["2026-07-30T12:00:00Z", "Visto há 3 meses"],
  ])("%s → %s", (visto, texto) => {
    expect(vistoHa(visto, agora)).toBe(texto);
  });
});

describe("convitePodeSair", () => {
  it("só da sala online para amigo online que não está tocando", () => {
    expect(convitePodeSair("ABCDE", { tipo: "menu" })).toBe(true);
    expect(convitePodeSair("ABCDE", { tipo: "multiplayer" })).toBe(true);
    expect(convitePodeSair(undefined, { tipo: "menu" })).toBe(false);
    expect(convitePodeSair("ABCDE", { tipo: "tocando", musica: "m", titulo: "t", artista: "a", dificuldade: "facil", instrumento: "guitarra", transmitindo: false })).toBe(false);
  });
});

describe("pedidosNovos", () => {
  const de = (conta_id: string) => ({ conta_id }) as PessoaDaAmizade;

  it("a primeira busca só marca o que já esperava, sem avisar", () => {
    expect(pedidosNovos(null, [de("a")])).toEqual([]);
  });

  it("avisa só os pedidos que não estavam na busca anterior", () => {
    expect(pedidosNovos([de("a")], [de("a"), de("b")]).map((p) => p.conta_id)).toEqual(["b"]);
    expect(pedidosNovos([de("a"), de("b")], [de("b")])).toEqual([]);
  });
});
