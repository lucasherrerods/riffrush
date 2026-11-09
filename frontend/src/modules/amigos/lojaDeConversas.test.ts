import type { MensagemPrivada } from "@/modules/presenca";
import { lerConversa } from "./conversas";
import { LojaDeConversas } from "./lojaDeConversas";

function montar(token: string | null = "t") {
  let entregar: (m: MensagemPrivada) => void = () => {};
  const api = {
    mensagens: vi.fn(async () => [{ id: 1, de: "ana", para: "eu", texto: "oi", enviada_em: "2026-11-09T12:00:00Z" }]),
    enviarMensagem: vi.fn(async (_t: string, para: string, texto: string) => ({ id: 2, de: "eu", para, texto, enviada_em: "2026-11-09T12:01:00Z" })),
    marcarLidas: vi.fn(async () => undefined),
    naoLidas: vi.fn(async () => [{ conta_id: "ana", quantas: 3 }]),
  };
  const avisarErro = vi.fn();
  const loja = new LojaDeConversas({
    api,
    token: () => token,
    meuId: () => "eu",
    ouvirPrivadas: (ouvinte) => {
      entregar = ouvinte;
      return () => {};
    },
    avisarErro,
  });
  const mudou = vi.fn();
  loja.inscrever(mudou);
  return { loja, api, avisarErro, mudou, entregar: (m: MensagemPrivada) => entregar(m) };
}

describe("LojaDeConversas", () => {
  it("carrega o histórico uma vez só por conversa", async () => {
    const { loja, api } = montar();
    await loja.carregar("ana");
    await loja.carregar("ana");
    expect(api.mensagens).toHaveBeenCalledTimes(1);
    expect(lerConversa(loja.estado(), "ana").mensagens.map((m) => m.texto)).toEqual(["oi"]);
  });

  it("o que a API guardou entra na conversa, e a cópia do relay não repete", async () => {
    const { loja, entregar } = montar();
    await loja.enviar("ana", "bora");
    entregar({ id: 2, de: { id: "eu", nome: "Eu", avatar: null }, para: "ana", texto: "bora", em: 1 });
    expect(lerConversa(loja.estado(), "ana").mensagens.map((m) => m.texto)).toEqual(["bora"]);
  });

  it("a mensagem recusada pela API vira aviso", async () => {
    const { loja, api, avisarErro } = montar();
    api.enviarMensagem.mockRejectedValueOnce(new Error("mensagens demais em pouco tempo"));
    await loja.enviar("ana", "oi");
    expect(avisarErro).toHaveBeenCalledWith("mensagens demais em pouco tempo");
  });

  it("as não lidas vêm da API e ler avisa a API", async () => {
    const { loja, api } = montar();
    await loja.carregarNaoLidas();
    expect(lerConversa(loja.estado(), "ana").naoLidas).toBe(3);
    loja.marcarComoLida("ana");
    expect(lerConversa(loja.estado(), "ana").naoLidas).toBe(0);
    expect(api.marcarLidas).toHaveBeenCalledWith("t", "ana");
  });

  it("sem conta logada, não chama a API", async () => {
    const { loja, api } = montar(null);
    await loja.carregar("ana");
    await loja.enviar("ana", "oi");
    await loja.carregarNaoLidas();
    expect(api.mensagens).not.toHaveBeenCalled();
    expect(api.enviarMensagem).not.toHaveBeenCalled();
    expect(api.naoLidas).not.toHaveBeenCalled();
  });
});
