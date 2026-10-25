import type { PosicaoNoRanking, RespostaDoRanking } from "./api";
import { montarPlacar } from "./placar";

const posicao = (n: number, nome: string, pontos: number): PosicaoNoRanking => ({ posicao: n, nome, avatar: null, pontos, acertos: 1, total: 1, jogada_em: "", partida_id: `p${n}` });

const ranking = (top: PosicaoNoRanking[], meu: PosicaoNoRanking | null = null): RespostaDoRanking => ({ jogadores: top.length, top, meu });

const nomes = (linhas: ReturnType<typeof montarPlacar>) => linhas.map((l) => `${l.posicao ?? "?"} ${l.nome}`);

describe("montarPlacar", () => {
  const top = ranking([posicao(1, "Ana", 9000), posicao(2, "Bia", 7000), posicao(3, "Caio", 5000), posicao(4, "Duda", 3000), posicao(5, "Edu", 1000)]);

  it("começando do zero, você fica depois de todos, com o primeiro e quem está logo acima", () => {
    expect(nomes(montarPlacar(top, 0, "Lucas"))).toEqual(["1 Ana", "4 Duda", "5 Edu", "6 Lucas"]);
  });

  it("passando alguém, você sobe e ele desce uma posição", () => {
    expect(nomes(montarPlacar(top, 3500, "Lucas"))).toEqual(["1 Ana", "2 Bia", "3 Caio", "4 Lucas", "5 Duda"]);
  });

  it("empatar não basta: precisa fazer mais pontos", () => {
    expect(montarPlacar(top, 3000, "Lucas").find((l) => l.voce)?.posicao).toBe(5);
  });

  it("em primeiro, você fica no topo e a lista completa com quem vem embaixo", () => {
    expect(nomes(montarPlacar(top, 10_000, "Lucas"))).toEqual(["1 Lucas", "2 Ana", "3 Bia", "4 Caio"]);
  });

  it("o seu recorde anterior entra como mais um adversário, marcado", () => {
    const comRecorde = ranking([posicao(1, "Ana", 9000), posicao(2, "Lucas", 4000)], posicao(2, "Lucas", 4000));
    const linhas = montarPlacar(comRecorde, 5000, "Lucas");
    expect(nomes(linhas)).toEqual(["1 Ana", "2 Lucas", "3 Lucas"]);
    expect(linhas.map((l) => (l.voce ? "ao vivo" : l.recorde ? "recorde" : "outro"))).toEqual(["outro", "ao vivo", "recorde"]);
  });

  it("o recorde anterior fora do top também aparece, na posição dele", () => {
    const fora = ranking([posicao(1, "Ana", 9000)], posicao(578, "Lucas", 100));
    expect(nomes(montarPlacar(fora, 50, "Lucas"))).toEqual(["1 Ana", "578 Lucas", "? Lucas"]);
  });

  it("abaixo do top, com mais jogadores fora dele, sua posição fica em aberto", () => {
    const longo = { ...ranking(Array.from({ length: 50 }, (_, i) => posicao(i + 1, `J${i + 1}`, 10_000 - i * 10))), jogadores: 928 };
    expect(montarPlacar(longo, 0, "Lucas").find((l) => l.voce)?.posicao).toBeNull();
    expect(montarPlacar(longo, 9_995, "Lucas").find((l) => l.voce)?.posicao).toBe(2);
  });

  it("sem ranking (ninguém jogou), você é o primeiro", () => {
    expect(nomes(montarPlacar(ranking([]), 0, "Lucas"))).toEqual(["1 Lucas"]);
  });
});
