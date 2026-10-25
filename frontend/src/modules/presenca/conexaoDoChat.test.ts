import { WebSocketFalso } from "@/test/websocketFalso";
import { ConexaoDoChatGlobal, aplicarMensagemDoChat, type EstadoDoChatGlobal, type MensagemGlobal } from "./conexaoDoChat";

const ana: MensagemGlobal = { n: 1, autor: { id: "a", nome: "Ana" }, texto: "oi", em: 1 };
const bia: MensagemGlobal = { n: 2, autor: { id: "b", nome: "Bia", equipe: true }, texto: "olá", em: 2 };
const VAZIO: EstadoDoChatGlobal = { conectado: true, mensagens: [], voce: null };
const PODE = { podeEscrever: true, admin: false, banido: false, nivelParaEscrever: 2 };
const aplicar = (estado: EstadoDoChatGlobal, msg: object) => aplicarMensagemDoChat(estado, JSON.stringify(msg));

describe("aplicarMensagemDoChat", () => {
  it("o histórico troca a lista e diz o que a pessoa pode, e cada mensagem nova entra no fim", () => {
    const estado = aplicar({ ...VAZIO, mensagens: [bia] }, { tipo: "historico", mensagens: [ana], voce: PODE });
    expect(estado.mensagens).toEqual([ana]);
    expect(estado.voce).toEqual(PODE);
    expect(aplicar(estado, { tipo: "mensagem", mensagem: bia }).mensagens).toEqual([ana, bia]);
  });

  it("mensagens apagadas pela equipe somem", () => {
    expect(aplicar({ ...VAZIO, mensagens: [ana, bia] }, { tipo: "apagadas", ns: [1] }).mensagens).toEqual([bia]);
  });

  it("banido ou desbanido, a permissão muda", () => {
    expect(aplicar({ ...VAZIO, voce: PODE }, { tipo: "voce", voce: { ...PODE, podeEscrever: false, banido: true } }).voce?.banido).toBe(true);
  });

  it("limpa de novo o que chega e descarta o que não tem o formato certo", () => {
    const suja = { ...ana, texto: "a‮b".padEnd(400, "x"), autor: { id: "a", nome: "Ana", equipe: "sim" } };
    const [limpa] = aplicar(VAZIO, { tipo: "mensagem", mensagem: suja }).mensagens;
    expect(limpa.texto.startsWith("ab")).toBe(true);
    expect(limpa.texto).toHaveLength(200);
    expect(limpa.autor).toEqual({ id: "a", nome: "Ana" });
    expect(aplicar({ ...VAZIO, mensagens: [ana] }, { tipo: "mensagem", mensagem: { n: 3, texto: "sem autor" } }).mensagens).toEqual([ana]);
    expect(aplicarMensagemDoChat({ ...VAZIO, mensagens: [ana] }, "lixo").mensagens).toEqual([ana]);
  });

  it("guarda só as últimas 50", () => {
    let estado = VAZIO;
    for (let n = 1; n <= 60; n++) estado = aplicar(estado, { tipo: "mensagem", mensagem: { ...ana, n } });
    expect(estado.mensagens).toHaveLength(50);
    expect(estado.mensagens[0].n).toBe(11);
  });
});

const umInstante = () => new Promise((fim) => setTimeout(fim, 0));
const socket = () => WebSocketFalso.ultimo!;

async function conectado(voce = PODE) {
  const chat = new ConexaoDoChatGlobal({ urlDoRelay: "wss://relay/", pedirFicha: async () => "f", criarSocket: (url, protocolos) => new WebSocketFalso(url, protocolos), esperar: () => {} });
  chat.ligar();
  await umInstante();
  socket().abrir();
  socket().entregar({ tipo: "historico", mensagens: [ana], voce });
  return chat;
}

describe("ConexaoDoChatGlobal", () => {
  it("entra com a ficha no subprotocolo, recebe o histórico e manda mensagens", async () => {
    const chat = await conectado();
    expect(socket().url).toBe("wss://relay/chat");
    expect(socket().protocolos).toEqual(["riffrush", "f"]);
    expect(chat.estado()).toMatchObject({ conectado: true, mensagens: [ana] });
    expect(chat.enviar("  e aí  ")).toBe(true);
    expect(socket().enviadas).toEqual([{ tipo: "mensagem", texto: "e aí" }]);
  });

  it("sem permissão para escrever, nem tenta", async () => {
    const chat = await conectado({ ...PODE, podeEscrever: false });
    expect(chat.enviar("oi")).toBe(false);
    expect(socket().enviadas).toEqual([]);
  });

  it("denunciar e apagar vão pelo relay, onde as mensagens ficam", async () => {
    const chat = await conectado();
    chat.denunciar(1);
    chat.apagar(1);
    expect(socket().enviadas).toEqual([
      { tipo: "denunciar", n: 1 },
      { tipo: "apagar", n: 1 },
    ]);
  });

  it("recusa aqui o que passaria do limite do relay", async () => {
    const chat = await conectado();
    for (let i = 0; i < 5; i++) expect(chat.enviar(`m${i}`)).toBe(true);
    expect(chat.enviar("demais")).toBe(false);
    expect(socket().enviadas).toHaveLength(5);
  });

  it("fica ligada enquanto alguma tela usa, e desliga quando a última sai", async () => {
    const chat = new ConexaoDoChatGlobal({ urlDoRelay: "wss://relay/", pedirFicha: async () => "f", criarSocket: (url, protocolos) => new WebSocketFalso(url, protocolos), esperar: () => {} });
    const sair1 = chat.usar();
    const sair2 = chat.usar();
    await umInstante();
    socket().abrir();
    sair1();
    expect(chat.estado().conectado).toBe(true);
    sair2();
    expect(chat.estado()).toMatchObject({ conectado: false, mensagens: [] });
  });
});
