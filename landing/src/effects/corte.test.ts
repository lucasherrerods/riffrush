import { poligonoDoCorte } from "./corte";

describe("poligonoDoCorte", () => {
  it("corta as duas quinas da guitarra com o tamanho pedido", () => {
    expect(poligonoDoCorte(16)).toBe("polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)");
  });

  it("nunca corta com tamanho negativo", () => {
    expect(poligonoDoCorte(-4)).toBe(poligonoDoCorte(0));
  });

  it("arredonda para pixels inteiros", () => {
    expect(poligonoDoCorte(12.6)).toBe(poligonoDoCorte(13));
  });
});
