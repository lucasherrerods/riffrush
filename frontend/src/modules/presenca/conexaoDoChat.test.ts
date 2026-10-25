import { WebSocketFalso } from "@/test/websocketFalso";
import { ConexaoDoChatGlobal, aplicarMensagemDoChat, type MensagemGlobal } from "./conexaoDoChat";

const ana: MensagemGlobal = { n: 1, autor: { id: "a", nome: "Ana" }, texto: "oi", em: 1 };
const bia: MensagemGlobal = { n: 2, autor: { id: "b", nome: "Bia" }, texto: "olá", em: 2 };

describe("aplicarMensagemDoChat", () => {
  it("o histórico troca a lista, e cada mensagem nova entra no fim", () => {
    const lista = aplicarMensagemDoChat([bia], JSON.stringify({ tipo: "historico", mensagens: [ana] }));
    expect(lista).toEqual([ana]);
    expect(aplicarMensagemDoChat(lista, JSON.stringify({ tipo: "mensagem", mensagem: bia }))).toEqual([ana, bia]);
  });

  it("limpa de novo o que chega e descarta o que não tem o formato certo", () => {
    const suja = { ...bia, texto: "a‮b".padEnd(400, "x") };
    const [limpa] = aplicarMensagemDoChat([], JSON.stringify({ tipo: "mensagem", mensagem: suja }));
    expect(limpa.texto.startsWith("ab")).toBe(true);
    expect(limpa.texto).toHaveLength(200);
    expect(aplicarMensagemDoChat([ana], JSON.stringify({ tipo: "mensagem", mensagem: { n: 3, texto: "sem autor" } }))).toEqual([ana]);
    expect(aplicarMensagemDoChat([ana], "lixo")).toEqual([ana]);
    expect(aplicarMensagemDoChat([], JSON.stringify({ tipo: "historico", mensagens: [ana, { n: "x" }] }))).toEqual([ana]);
  });

  it("guarda só as últimas 50", () => {
    let lista: MensagemGlobal[] = [];
    for (let n = 1; n <= 60; n++) lista = aplicarMensagemDoChat(lista, JSON.stringify({ tipo: "mensagem", mensagem: { ...ana, n } }));
    expect(lista).toHaveLength(50);
    expect(lista[0].n).toBe(11);
  });
});

const umInstante = () => new Promise((fim) => setTimeout(fim, 0));
const socket = () => WebSocketFalso.ultimo!;

function montar() {
  return new ConexaoDoChatGlobal({ urlDoRelay: "wss://relay/", pedirFicha: async () => "f", criarSocket: (url) => new WebSocketFalso(url), esperar: () => {} });
}

describe("ConexaoDoChatGlobal", () => {
  it("entra com a ficha, recebe o histórico e manda mensagens", async () => {
    const chat = montar();
    chat.ligar();
    await umInstante();
    expect(socket().url).toBe("wss://relay/chat?ficha=f");
    socket().abrir();
    socket().entregar({ tipo: "historico", mensagens: [ana] });
    expect(chat.estado()).toEqual({ conectado: true, mensagens: [ana] });
    expect(chat.enviar("  e aí  ")).toBe(true);
    expect(socket().enviadas).toEqual([{ texto: "e aí" }]);
  });

  it("recusa aqui o que passaria do limite do relay", async () => {
    const chat = montar();
    chat.ligar();
    await umInstante();
    socket().abrir();
    for (let i = 0; i < 5; i++) expect(chat.enviar(`m${i}`)).toBe(true);
    expect(chat.enviar("demais")).toBe(false);
    expect(socket().enviadas).toHaveLength(5);
  });

  it("fica ligada enquanto alguma tela usa, e desliga quando a última sai", async () => {
    const chat = montar();
    const sair1 = chat.usar();
    const sair2 = chat.usar();
    await umInstante();
    socket().abrir();
    sair1();
    expect(chat.estado().conectado).toBe(true);
    sair2();
    expect(chat.estado()).toEqual({ conectado: false, mensagens: [] });
  });
});
