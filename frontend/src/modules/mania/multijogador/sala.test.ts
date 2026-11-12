import { invoke } from "@tauri-apps/api/core";
import { WebSocketFalso } from "@/test/websocketFalso";
import type { ConjuntoSalvo, DificuldadeSalva } from "../beatmaps/biblioteca";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const dificuldade = { hash: "h1", dificuldade: "Hard", teclas: 4 } as DificuldadeSalva;
const importado = { id: "arquivo:h1", origem: "importado", titulo: "Musica", tituloUnicode: "", artista: "Banda", artistaUnicode: "", mapper: "", mapas: [dificuldade], usadoEm: 0 } as ConjuntoSalvo;

async function salaDoHost(online = false) {
  vi.resetModules();
  const sala = await import("./sala");
  if (online) sala.criarSalaOnline({ nome: "Lu" });
  else await sala.criarSala({ nome: "Lu" });
  WebSocketFalso.ultimo!.abrir();
  WebSocketFalso.ultimo!.receber(0, { tipo: "bemVindo", id: 1 });
  return sala;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("WebSocket", WebSocketFalso);
  vi.stubEnv("VITE_URL_DO_RELAY", "wss://relay.teste");
  vi.mocked(invoke).mockImplementation(async (comando) => (comando === "lan_criar_sala" ? { ip: "192.168.0.5", porta: 7777, endereco: "http://192.168.0.5:7777" } : undefined));
});

describe("sala do Mania", () => {
  it("na LAN, o host compartilha o .osz do mapa importado antes de avisar a sala", async () => {
    const sala = await salaDoHost();
    await sala.escolherMapa(importado, dificuldade, 64, async () => new Blob(["osz"]));
    expect(invoke).toHaveBeenCalledWith("lan_compartilhar_musica", expect.any(Uint8Array), expect.anything());
    expect(WebSocketFalso.ultimo!.enviadas.at(-1)).toMatchObject({ tipo: "sala", modo: "mania", mods: 64, mapa: { tipo: "importado", hash: "h1" } });
  });

  it("no online, mapa importado não vai: ele não tem como chegar nos outros", async () => {
    const sala = await salaDoHost(true);
    await expect(sala.escolherMapa(importado, dificuldade, 0, async () => undefined)).rejects.toThrow(/online/);
  });

  it("não começa sem mapa", async () => {
    const sala = await salaDoHost();
    expect(() => sala.comecar()).toThrow(/mapa/);
  });
});
