import { ABERTURA, aberturaPodeComecar, descidaDaPista, ritmoDaAbertura, teclaDaAbertura } from "./abertura";

describe("abertura da partida", () => {
  it("a pista começa fora da tela, sobe e para no lugar", () => {
    expect(descidaDaPista(0)).toBe(1);
    const meio = descidaDaPista(ABERTURA.atrasoDaPista + ABERTURA.duracaoDaPista / 2);
    expect(meio).toBeGreaterThan(0);
    expect(meio).toBeLessThan(1);
    expect(descidaDaPista(ABERTURA.atrasoDaPista + ABERTURA.duracaoDaPista)).toBe(0);
  });

  it("os trastes são teclados um de cada vez", () => {
    const instante = ABERTURA.atrasoDosTrastes + 0.1;
    expect(teclaDaAbertura(instante, 0).elevacao).toBe(1);
    expect(teclaDaAbertura(instante, 2).elevacao).toBe(0);
    expect(teclaDaAbertura(instante + ABERTURA.passoDosTrastes * 2, 2).elevacao).toBe(1);
  });

  it("depois da abertura nenhum traste continua levantado", () => {
    for (let traste = 0; traste < 5; traste++) expect(teclaDaAbertura(10, traste)).toEqual({ elevacao: 0, chama: 0 });
  });

  it("espera a entrada sair da frente e a tela parar de travar", () => {
    expect(aberturaPodeComecar(true, 16)).toBe(false);
    expect(aberturaPodeComecar(false, 900)).toBe(false);
    expect(aberturaPodeComecar(false, 16)).toBe(true);
  });

  it("com pouco tempo até a música, anda mais rápido; com tempo de sobra, no ritmo normal", () => {
    expect(ritmoDaAbertura(4)).toBe(1);
    expect(ritmoDaAbertura(1)).toBeGreaterThan(1);
  });
});
