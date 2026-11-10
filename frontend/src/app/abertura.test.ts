import { aberturaPronta } from "./abertura";

describe("aberturaPronta", () => {
  const tudoPronto = { contasLigadas: true, contaIniciada: true, contaCarregando: false, trilhaPronta: true, esgotou: false };

  it("abre quando o perfil e a primeira música estão prontos", () => {
    expect(aberturaPronta(tudoPronto)).toBe(true);
  });

  it("espera o perfil terminar de carregar", () => {
    expect(aberturaPronta({ ...tudoPronto, contaIniciada: false })).toBe(false);
    expect(aberturaPronta({ ...tudoPronto, contaCarregando: true })).toBe(false);
  });

  it("sem contas no jogo, não espera o perfil", () => {
    expect(aberturaPronta({ ...tudoPronto, contasLigadas: false, contaIniciada: false })).toBe(true);
  });

  it("espera a primeira música, que também traz a capa do fundo", () => {
    expect(aberturaPronta({ ...tudoPronto, trilhaPronta: false })).toBe(false);
  });

  it("passado o tempo limite, abre de qualquer jeito", () => {
    expect(aberturaPronta({ ...tudoPronto, contaIniciada: false, trilhaPronta: false, esgotou: true })).toBe(true);
  });
});
