import { invoke } from "@tauri-apps/api/core";
import { WebSocketFalso } from "@/test/websocketFalso";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

/** Uma conexão de um modo que não é o Rock, com um protocolo de mentira. */
async function conexaoDoMania() {
  vi.resetModules();
  const { criarProtocolo } = await import("./protocolo");
  const { criarConexaoDaSala } = await import("./conexao");
  const protocolo = criarProtocolo<{ mapa: string }, { modo?: string; mapa?: string }, { nome: string }, { pontos: number; terminou: boolean }>({
    nome: "Mania",
    escolhaInicial: { mapa: "a" },
    idDaEscolha: (e) => e.mapa,
    escreverEscolha: (e) => ({ modo: "mania", mapa: e.mapa }),
    lerEscolha: (m) => (m.modo === "mania" && m.mapa ? { mapa: m.mapa } : null),
  });
  return criarConexaoDaSala(protocolo, "mania");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("WebSocket", WebSocketFalso);
  vi.stubEnv("VITE_URL_DO_RELAY", "wss://relay.teste");
});

describe("conexão de um modo que não é o Rock", () => {
  it("a sala da LAN nasce com o modo, para o anúncio separar as salas", async () => {
    vi.mocked(invoke).mockResolvedValue({ ip: "192.168.0.5", porta: 7777, endereco: "http://192.168.0.5:7777" });
    await (await conexaoDoMania()).criarSala({ nome: "Lu" });
    expect(invoke).toHaveBeenCalledWith("lan_criar_sala", { nome: "Lu", modo: "mania" });
  });

  it("a sala online nasce com o modo", async () => {
    (await conexaoDoMania()).criarSalaOnline({ nome: "Lu" });
    expect(WebSocketFalso.ultimo!.url).toBe("wss://relay.teste/criar?nome=Lu&modo=mania");
  });

  it("só lista as salas do próprio modo; as sem modo são do Rock", async () => {
    const salas = [
      { codigo: "AAAAA", nome: "Rock antigo", jogadores: 1 },
      { codigo: "BBBBB", nome: "Mania", jogadores: 1, modo: "mania" },
    ];
    const buscar = vi.fn(async () => new Response(JSON.stringify(salas)));
    expect((await (await conexaoDoMania()).procurarSalasOnline(buscar)).map((s) => s.nome)).toEqual(["Mania"]);
  });

  it("dá pronto pela escolha atual e larga quando todos estão prontos", async () => {
    const conexao = await conexaoDoMania();
    conexao.entrarNaSala("http://h:7777", { nome: "Ana" });
    const socket = WebSocketFalso.ultimo!;
    socket.abrir();
    socket.receber(0, { tipo: "bemVindo", id: 2 });
    socket.receber(1, { tipo: "sala", jogadores: [], prontos: [], modo: "mania", mapa: "x" });
    conexao.marcarPronto(true);
    expect(socket.enviadas.at(-1)).toEqual({ tipo: "pronto", musicaId: "x", pronto: true });
  });
});
