import { OPCOES_PADRAO_DA_PARTIDA } from "./TelaDeJogo";
import { opcoesPeloNumeroDeJogadores, viewportsDaTela } from "./telaDividida";

describe("viewportsDaTela", () => {
  it("um jogador ocupa a tela toda", () => {
    expect(viewportsDaTela(1)).toEqual([{ esquerda: 0, largura: 1 }]);
  });

  it("as pistas ficam lado a lado, em colunas iguais e sem sobra", () => {
    const tres = viewportsDaTela(3);
    expect(tres.map((v) => v.largura)).toEqual([1 / 3, 1 / 3, 1 / 3]);
    expect(tres.map((v) => v.esquerda)).toEqual([0, 1 / 3, 2 / 3]);
  });
});

describe("opcoesPeloNumeroDeJogadores", () => {
  const opcoes = { ...OPCOES_PADRAO_DA_PARTIDA, efeitos: true, escalaDeRenderizacao: 1, personagem: true };

  it("sozinho nada muda", () => {
    expect(opcoesPeloNumeroDeJogadores(opcoes, 1)).toEqual(opcoes);
  });

  it("com dois, tira o personagem e mantém os efeitos", () => {
    const duas = opcoesPeloNumeroDeJogadores(opcoes, 2);
    expect(duas.personagem).toBe(false);
    expect(duas.efeitos).toBe(true);
    expect(duas.escalaDeRenderizacao).toBe(1);
  });

  it("com três ou mais, desliga os efeitos e baixa a resolução da pista", () => {
    const quatro = opcoesPeloNumeroDeJogadores(opcoes, 4);
    expect(quatro.efeitos).toBe(false);
    expect(quatro.escalaDeRenderizacao).toBeLessThan(1);
  });

  it("não sobe a resolução de quem já escolheu uma menor", () => {
    expect(opcoesPeloNumeroDeJogadores({ ...opcoes, escalaDeRenderizacao: 0.5 }, 4).escalaDeRenderizacao).toBe(0.5);
  });
});
