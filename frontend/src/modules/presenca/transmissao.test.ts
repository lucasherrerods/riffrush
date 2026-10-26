import { WebSocketFalso } from "@/test/websocketFalso";
import { criarTransmissao } from "./transmissao";

const partida = { contaId: "id-1", musica: "encore:abc", dificuldade: "expert", instrumento: "baixo" } as const;
const umInstante = () => new Promise((fim) => setTimeout(fim, 0));

function montar(pedirFicha = vi.fn(async () => "ficha")) {
  return criarTransmissao(partida, { urlDoRelay: "wss://relay", pedirFicha, criarSocket: (url, protocolos) => new WebSocketFalso(url, protocolos) });
}

describe("criarTransmissao", () => {
  beforeEach(() => (WebSocketFalso.ultimo = null));

  it("abre a transmissão da conta com a ficha e manda o que juntou enquanto conectava", async () => {
    const transmitir = montar();
    transmitir({ tipo: "inicio", hashDoChart: "a".repeat(32), semFalha: false, velocidade: 1 });
    transmitir({ tipo: "lote", entradas: [{ tempo: 1.5, tipo: "tocar", pista: 2 }], ate: 1.6 });
    await umInstante();
    const socket = WebSocketFalso.ultimo!;
    expect(socket.url).toBe("wss://relay/transmissao/id-1");
    expect(socket.protocolos).toEqual(["riffrush", "ficha"]);
    socket.abrir();
    expect(socket.enviadas).toEqual([
      { tipo: "inicio", partida: { musica: "encore:abc", dificuldade: "expert", instrumento: "baixo", hashDoChart: "a".repeat(32), semFalha: false, velocidade: 1 } },
      { tipo: "lote", ate: 1.6, entradas: [[1500, 2]] },
    ]);
  });

  it("a pausa e o fim vão para o relay, e o fim fecha a conexão", async () => {
    const transmitir = montar();
    transmitir({ tipo: "inicio", hashDoChart: "a".repeat(32), semFalha: false, velocidade: 1 });
    await umInstante();
    const socket = WebSocketFalso.ultimo!;
    socket.abrir();
    transmitir({ tipo: "pausa", pausado: true });
    transmitir({ tipo: "fim" });
    expect(socket.enviadas.slice(1)).toEqual([{ tipo: "pausa", pausado: true }, { tipo: "fim" }]);
    expect(socket.fechado).toBe(true);
  });

  it("o link do chart do Encore vai junto no início", async () => {
    const transmitir = criarTransmissao(
      { ...partida, urlDoEncore: "https://files.enchor.us/x.sng" },
      { urlDoRelay: "wss://relay", pedirFicha: async () => "ficha", criarSocket: (url, protocolos) => new WebSocketFalso(url, protocolos) },
    );
    transmitir({ tipo: "inicio", hashDoChart: "a".repeat(32), semFalha: false, velocidade: 1 });
    await umInstante();
    WebSocketFalso.ultimo!.abrir();
    expect(WebSocketFalso.ultimo!.enviadas[0]).toMatchObject({ partida: { urlDoEncore: "https://files.enchor.us/x.sng" } });
  });

  it("recomeçar depois do fim abre uma transmissão nova", async () => {
    const transmitir = montar();
    transmitir({ tipo: "inicio", hashDoChart: "a".repeat(32), semFalha: false, velocidade: 1 });
    await umInstante();
    WebSocketFalso.ultimo!.abrir();
    transmitir({ tipo: "fim" });
    transmitir({ tipo: "inicio", hashDoChart: "b".repeat(32), semFalha: false, velocidade: 1 });
    await umInstante();
    const nova = WebSocketFalso.ultimo!;
    nova.abrir();
    transmitir({ tipo: "lote", entradas: [], ate: 2 });
    expect(nova.enviadas.map((m) => (m as { tipo: string }).tipo)).toEqual(["inicio", "lote"]);
    expect(nova.fechado).toBe(false);
  });

  it("sem ficha a partida segue: nada é aberto e nada quebra", async () => {
    const transmitir = montar(vi.fn(async () => Promise.reject(new Error("fora"))));
    transmitir({ tipo: "inicio", hashDoChart: "a".repeat(32), semFalha: false, velocidade: 1 });
    await umInstante();
    expect(() => transmitir({ tipo: "lote", entradas: [], ate: 1 })).not.toThrow();
    expect(WebSocketFalso.ultimo).toBeNull();
  });
});

describe("quem está assistindo", () => {
  beforeEach(() => (WebSocketFalso.ultimo = null));

  it("o relay conta quantas pessoas estão assistindo, e cair a conexão zera", async () => {
    const aoContarEspectadores = vi.fn();
    const transmitir = criarTransmissao(partida, {
      urlDoRelay: "wss://relay",
      pedirFicha: async () => "ficha",
      criarSocket: (url, protocolos) => new WebSocketFalso(url, protocolos),
      aoContarEspectadores,
    });
    transmitir({ tipo: "inicio", hashDoChart: "a".repeat(32), semFalha: false, velocidade: 1 });
    await umInstante();
    const socket = WebSocketFalso.ultimo!;
    socket.abrir();

    socket.entregar({ tipo: "espectadores", quantos: 3 });
    expect(aoContarEspectadores).toHaveBeenLastCalledWith(3);

    socket.fecharPeloServidor("saiu");
    expect(aoContarEspectadores).toHaveBeenLastCalledWith(0);
  });
});
