import { invoke } from "@tauri-apps/api/core";
import { PERSONAGEM_PADRAO } from "@/modules/character";
import { MUSICAS_EMBUTIDAS } from "@/modules/songs";
import { WebSocketFalso } from "@/test/websocketFalso";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

async function importar() {
  vi.resetModules();
  return import("./sala");
}

const socket = () => WebSocketFalso.ultimo!;

beforeEach(() => {
  vi.clearAllMocks();
  WebSocketFalso.ultimo = null;
  vi.stubGlobal("WebSocket", WebSocketFalso);
  vi.mocked(invoke).mockImplementation(async (comando) =>
    comando === "lan_criar_sala" ? { ip: "192.168.0.5", porta: 7777, endereco: "http://192.168.0.5:7777" } : undefined,
  );
});

describe("sala", () => {
  it("criar a sala abre o servidor e entra nele como host", async () => {
    const sala = await importar();
    await sala.criarSala(PERSONAGEM_PADRAO);
    expect(invoke).toHaveBeenCalledWith("lan_criar_sala", { nome: "Rockstar" });
    expect(socket().url).toBe("ws://127.0.0.1:7777/ws");
    expect(sala.lerConexao()).toMatchObject({ info: { endereco: "http://192.168.0.5:7777" }, sala: { souHost: true } });
  });

  it("entrar numa sala conecta no endereço do host", async () => {
    const sala = await importar();
    sala.entrarNaSala("http://192.168.0.5:7777", PERSONAGEM_PADRAO);
    expect(socket().url).toBe("ws://192.168.0.5:7777/ws");
    expect(sala.lerConexao().sala?.souHost).toBe(false);
  });

  it("responde às mensagens da sala pelo protocolo", async () => {
    const sala = await importar();
    sala.entrarNaSala("http://h:7777", PERSONAGEM_PADRAO);
    socket().abrir();
    socket().receber(0, { tipo: "bemVindo", id: 2 });
    expect(socket().enviadas).toEqual([{ tipo: "oi", personagem: PERSONAGEM_PADRAO }]);
    expect(sala.lerConexao().sala?.meuId).toBe(2);
  });

  it("avisa quando não consegue conectar", async () => {
    const sala = await importar();
    sala.entrarNaSala("http://h:7777", PERSONAGEM_PADRAO);
    socket().falhar();
    expect(sala.lerConexao()).toMatchObject({ sala: null, erro: expect.stringMatching(/Não consegui conectar/) });
  });

  it("sai da sala quando ela fica cheia", async () => {
    const sala = await importar();
    sala.entrarNaSala("http://h:7777", PERSONAGEM_PADRAO);
    socket().abrir();
    socket().receber(0, { tipo: "cheia" });
    expect(sala.lerConexao()).toMatchObject({ sala: null, erro: expect.stringMatching(/4 jogadores/) });
    expect(socket().fechado).toBe(true);
  });

  it("o host que sai fecha o servidor", async () => {
    const sala = await importar();
    await sala.criarSala(PERSONAGEM_PADRAO);
    sala.sairDaSala();
    expect(invoke).toHaveBeenCalledWith("lan_fechar_sala");
    expect(sala.lerConexao().sala).toBeNull();
  });

  it("envia o estado do jogador durante a partida", async () => {
    const sala = await importar();
    sala.entrarNaSala("http://h:7777", PERSONAGEM_PADRAO);
    socket().abrir();
    sala.enviarEstado({ pontos: 10, vida: 0.5, sequencia: 1, pulso: 1, derrota: false, terminou: false });
    expect(socket().enviadas).toContainEqual({ tipo: "estado", pontos: 10, vida: 0.5, sequencia: 1, pulso: 1, derrota: false, terminou: false });
  });

  it("antes de começar com música importada, o host compartilha o arquivo", async () => {
    const sala = await importar();
    await sala.criarSala(PERSONAGEM_PADRAO);
    socket().abrir();
    socket().receber(0, { tipo: "bemVindo", id: 1 });
    const importada = { ...MUSICAS_EMBUTIDAS[0], id: "arquivo:x", arquivo: new File(["abc"], "x.wav", { type: "audio/wav" }) };
    await sala.comecar(importada);
    expect(invoke).toHaveBeenCalledWith("lan_compartilhar_musica", expect.any(Uint8Array), { headers: { "x-tipo": "audio/wav" } });
    expect(socket().enviadas.at(-1)).toMatchObject({ tipo: "comecar" });
  });
});
