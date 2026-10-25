import { assinarPedido, conferirPedido } from "./assinatura";

// O mesmo valor do teste da API (backend/src/modules/moderacao/dominio.rs): os dois lados precisam concordar.
const ASSINATURA_DE_EXEMPLO = "WMGSmjB_GSo12gmWNGJr3IcGHkQIsO9CV5f5-DZC_V8";

describe("assinatura dos pedidos entre o relay e a API", () => {
  it("assina igual à API", async () => {
    expect(await assinarPedido("segredo-de-teste", 1_800_000_000, '{"oi":1}')).toBe(ASSINATURA_DE_EXEMPLO);
  });

  it("confere o pedido assinado e recente", async () => {
    const assinatura = await assinarPedido("s", 1000, "corpo");
    expect(await conferirPedido("s", 1000, 1100, "corpo", assinatura)).toBe(true);
    expect(await conferirPedido("outro", 1000, 1100, "corpo", assinatura)).toBe(false);
    expect(await conferirPedido("s", 1000, 1100, "corpo mudado", assinatura)).toBe(false);
    expect(await conferirPedido("s", 1000, 1000 + 301, "corpo", assinatura)).toBe(false);
    expect(await conferirPedido("s", 1000, 1100, "corpo", "lixo!")).toBe(false);
    expect(await conferirPedido("", 1000, 1100, "corpo", assinatura)).toBe(false);
  });
});
