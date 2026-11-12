import { criarProtocolo, type ModoDaSala } from "./protocolo";

/** Um modo de mentira: a escolha é só um mapa, e as mensagens dele levam `modo: "teste"`. */
type Escolha = { mapa: string };
type NaRede = { modo?: string; mapa?: unknown };
const modoDeTeste: ModoDaSala<Escolha, NaRede> = {
  nome: "Teste",
  escolhaInicial: { mapa: "a" },
  idDaEscolha: (e) => e.mapa,
  escreverEscolha: (e) => ({ modo: "teste", mapa: e.mapa }),
  lerEscolha: (m) => (m.modo === "teste" && typeof m.mapa === "string" ? { mapa: m.mapa } : null),
};
const protocolo = criarProtocolo<Escolha, NaRede, { nome: string; nivel?: number }, { pontos: number; terminou: boolean }>(modoDeTeste);

function salaDoConvidado() {
  return protocolo.reduzir(protocolo.estadoInicial({ nome: "Ana" }, false), 0, { tipo: "bemVindo", id: 2 }, 0).estado;
}

describe("protocolo da sala", () => {
  it("o host manda a escolha espalhada na mensagem, com os campos do modo", () => {
    const host = protocolo.reduzir(protocolo.estadoInicial({ nome: "Lu" }, true), 0, { tipo: "bemVindo", id: 1 }, 0).estado;
    const { enviar, estado } = protocolo.escolher(host, { mapa: "b" });
    expect(estado.mapa).toBe("b");
    expect(enviar).toEqual([{ tipo: "sala", jogadores: [], prontos: [], modo: "teste", mapa: "b" }]);
  });

  it("o convidado lê a escolha do host", () => {
    const { estado } = protocolo.reduzir(salaDoConvidado(), 1, { tipo: "sala", jogadores: [], prontos: [], modo: "teste", mapa: "c" }, 0);
    expect(estado.mapa).toBe("c");
    expect(estado.hostId).toBe(1);
  });

  it("sala de outro modo tira o jogador com um aviso, em vez de abrir uma partida que ele não sabe jogar", () => {
    const reacao = protocolo.reduzir(salaDoConvidado(), 1, { tipo: "sala", jogadores: [], prontos: [], mapa: "c" }, 0);
    expect(reacao.sair).toMatch(/outro modo/);
  });

  it("a largada leva a escolha e marca o início para todos", () => {
    const { estado } = protocolo.reduzir(salaDoConvidado(), 1, { tipo: "comecar", modo: "teste", mapa: "d" }, 100);
    expect(estado).toMatchObject({ status: "jogando", mapa: "d", partidas: 1 });
    expect(estado.inicio).toBeGreaterThan(100);
  });

  it("o pronto vale para a escolha atual, pelo id do modo", () => {
    let host = protocolo.reduzir(protocolo.estadoInicial({ nome: "Lu" }, true), 0, { tipo: "bemVindo", id: 1 }, 0).estado;
    host = protocolo.reduzir(host, 2, { tipo: "oi", personagem: { nome: "Ana" } }, 0).estado;
    expect(protocolo.reduzir(host, 2, { tipo: "pronto", musicaId: "outro", pronto: true }, 0).estado.prontos).toEqual([]);
    host = protocolo.reduzir(host, 2, { tipo: "pronto", musicaId: "a", pronto: true }, 0).estado;
    expect(protocolo.todosProntos(host)).toBe(true);
    expect(protocolo.comecarPartida(host, "00000000-0000-0000-0000-000000000000")).toEqual([
      { tipo: "comecar", modo: "teste", mapa: "a", rodada: "00000000-0000-0000-0000-000000000000" },
    ]);
  });

  it("guarda o placar ao vivo de cada adversário", () => {
    const { estado } = protocolo.reduzir(salaDoConvidado(), 3, { tipo: "estado", pontos: 10, terminou: false }, 0);
    expect(estado.adversarios[3]).toEqual({ pontos: 10, terminou: false });
  });
});
