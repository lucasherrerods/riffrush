import { WebSocketFalso } from "@/test/websocketFalso";
import { ConexaoDePresenca } from "./conexao";

function montar(pedirFicha = vi.fn(async () => "ficha")) {
  const esperas: (() => void)[] = [];
  const conexao = new ConexaoDePresenca({
    urlDoRelay: "wss://relay",
    pedirFicha,
    criarSocket: (url, protocolos) => new WebSocketFalso(url, protocolos),
    esperar: (fn) => esperas.push(fn),
  });
  return { conexao, esperas, pedirFicha };
}

const socket = () => WebSocketFalso.ultimo!;
const umInstante = () => new Promise((fim) => setTimeout(fim, 0));

describe("ConexaoDePresenca", () => {
  it("conecta com a ficha, manda onde a pessoa está e acompanha a lista", async () => {
    const { conexao } = montar();
    conexao.definirEstado({ tipo: "menu" });
    conexao.ligar();
    await umInstante();
    expect(socket().url).toBe("wss://relay/presenca");
    expect(socket().protocolos).toEqual(["riffrush", "ficha"]);
    socket().abrir();
    expect(socket().enviadas).toEqual([{ estado: { tipo: "menu" } }]);
    socket().entregar({ tipo: "lista", pessoas: [{ id: "a", nome: "Ana", avatar: null, estado: { tipo: "menu" } }] });
    expect(conexao.estado()).toMatchObject({ conectada: true, pessoas: [{ nome: "Ana" }] });
  });

  it("mudar de estado com a conexão aberta avisa o relay", async () => {
    const { conexao } = montar();
    conexao.ligar();
    await umInstante();
    socket().abrir();
    const tocando = { tipo: "tocando", musica: "m", titulo: "T", artista: "A", dificuldade: "facil", instrumento: "guitarra", transmitindo: false } as const;
    conexao.definirEstado(tocando);
    expect(socket().enviadas.at(-1)).toEqual({ estado: tocando });
  });

  it("o mesmo estado de novo não vai ao relay", async () => {
    const { conexao } = montar();
    conexao.ligar();
    await umInstante();
    socket().abrir();
    const naSala = { tipo: "multiplayer", sala: { jogadores: 2, online: true } } as const;
    conexao.definirEstado(naSala);
    conexao.definirEstado({ tipo: "multiplayer", sala: { jogadores: 2, online: true } });
    expect(socket().enviadas).toEqual([{ estado: { tipo: "menu" } }, { estado: naSala }]);
  });

  it("convida pela mesma conexão e avisa quem ouve os convites, sem mexer na lista", async () => {
    const { conexao } = montar();
    const recebidos = vi.fn();
    conexao.ouvirConvites(recebidos);
    conexao.ligar();
    await umInstante();
    socket().abrir();
    conexao.convidar("b", "ABCDE");
    expect(socket().enviadas.at(-1)).toEqual({ tipo: "convite", para: "b", codigo: "ABCDE" });
    socket().entregar({ tipo: "convite", de: { id: "a", nome: "Ana", avatar: null }, codigo: "ABCDE" });
    expect(recebidos).toHaveBeenCalledWith({ de: { id: "a", nome: "Ana", avatar: null }, codigo: "ABCDE" });
    expect(conexao.estado().pessoas).toEqual([]);
  });

  it("a rede caiu: limpa a lista e tenta de novo, com ficha nova", async () => {
    const { conexao, esperas, pedirFicha } = montar();
    conexao.ligar();
    await umInstante();
    socket().abrir();
    socket().falhar();
    expect(conexao.estado()).toEqual({ conectada: false, pessoas: [] });
    expect(esperas).toHaveLength(1);
    esperas[0]();
    await umInstante();
    expect(pedirFicha).toHaveBeenCalledTimes(2);
  });

  it("aberta em outro aparelho, esta conexão sai e não volta", async () => {
    const { conexao, esperas } = montar();
    conexao.ligar();
    await umInstante();
    socket().abrir();
    socket().fecharPeloServidor("outroAparelho");
    expect(esperas).toHaveLength(0);
  });

  it("desligar fecha e não reconecta", async () => {
    const { conexao, esperas } = montar();
    conexao.ligar();
    await umInstante();
    socket().abrir();
    conexao.desligar();
    expect(socket().fechado).toBe(true);
    expect(esperas).toHaveLength(0);
  });

  it("sem conseguir a ficha (API fora), tenta de novo mais tarde", async () => {
    const { conexao, esperas } = montar(vi.fn(async () => Promise.reject(new Error("fora"))));
    conexao.ligar();
    await umInstante();
    expect(esperas).toHaveLength(1);
  });
});
