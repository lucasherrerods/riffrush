import { MUSICAS_EMBUTIDAS } from "@/modules/songs";
import { PERSONAGEM_PADRAO, type Personagem } from "@/modules/character";
import type { EstadoDoJogador } from "@/modules/gameplay";
import {
  ATRASO_DO_INICIO_MS,
  MAXIMO_DE_JOGADORES,
  comecarPartida,
  escolherMusica,
  estadoInicial,
  reduzir,
  todosProntos,
  type EstadoDaSala,
} from "./protocolo";

const vitor: Personagem = { ...PERSONAGEM_PADRAO, nome: "Vitor" };
const lucas: Personagem = { ...PERSONAGEM_PADRAO, nome: "Lucas" };
const jogada: EstadoDoJogador = { pontos: 500, vida: 0.7, sequencia: 12, pulso: 15, derrota: false, terminou: false };

/** Sala do ponto de vista do host (id 1), já com ele dentro. */
function salaDoHost(): EstadoDaSala {
  const inicio = estadoInicial(lucas, true);
  return reduzir(inicio, 0, { tipo: "bemVindo", id: 1 }, 0).estado;
}

/** Sala do ponto de vista de um convidado (id 2). */
function salaDoConvidado(): EstadoDaSala {
  const inicio = estadoInicial(vitor, false);
  return reduzir(inicio, 0, { tipo: "bemVindo", id: 2 }, 0).estado;
}

// Bug: a sala começava numa música que saiu do catálogo, e o convidado ficava sem música.
describe("estadoInicial", () => {
  it("a sala começa com a primeira música do catálogo", () => {
    expect(estadoInicial(lucas, true).musica).toEqual({ tipo: "embutida", id: MUSICAS_EMBUTIDAS[0].id });
  });
});

describe("reduzir", () => {
  it("ao entrar, guarda o próprio id e se apresenta para a sala", () => {
    const { estado, enviar } = reduzir(estadoInicial(vitor, false), 0, { tipo: "bemVindo", id: 2 }, 0);
    expect(estado).toMatchObject({ status: "naSala", meuId: 2 });
    expect(enviar).toEqual([{ tipo: "oi", personagem: vitor }]);
  });

  it("o host vira dono da sala com o próprio id", () => {
    expect(salaDoHost().hostId).toBe(1);
  });

  it("o host registra quem chega e manda a sala atualizada para todos", () => {
    const { estado, enviar } = reduzir(salaDoHost(), 2, { tipo: "oi", personagem: vitor }, 0);
    expect(estado.jogadores).toEqual([{ id: 2, personagem: vitor }]);
    expect(enviar).toEqual([{ tipo: "sala", jogadores: estado.jogadores, musica: estado.musica, dificuldade: estado.dificuldade, prontos: [] }]);
  });

  it("um jogador que muda o personagem não aparece duas vezes", () => {
    let { estado } = reduzir(salaDoHost(), 2, { tipo: "oi", personagem: vitor }, 0);
    estado = reduzir(estado, 2, { tipo: "oi", personagem: { ...vitor, nome: "Vitão" } }, 0).estado;
    expect(estado.jogadores.map((j) => j.personagem.nome)).toEqual(["Vitão"]);
  });

  it("os jogadores ficam em ordem de chegada", () => {
    let { estado } = reduzir(salaDoHost(), 3, { tipo: "oi", personagem: vitor }, 0);
    estado = reduzir(estado, 1, { tipo: "oi", personagem: lucas }, 0).estado;
    expect(estado.jogadores.map((j) => j.id)).toEqual([1, 3]);
  });

  it("o convidado ignora apresentações (só o host cuida da lista)", () => {
    const { enviar } = reduzir(salaDoConvidado(), 3, { tipo: "oi", personagem: lucas }, 0);
    expect(enviar).toEqual([]);
  });

  it("o convidado adota a sala enviada pelo host", () => {
    const jogadores = [{ id: 1, personagem: lucas }, { id: 2, personagem: vitor }];
    const { estado } = reduzir(salaDoConvidado(), 1, { tipo: "sala", jogadores, musica: { tipo: "embutida", id: "overdrive" }, dificuldade: "expert", prontos: [] }, 0);
    expect(estado).toMatchObject({ hostId: 1, jogadores, musica: { id: "overdrive" }, dificuldade: "expert" });
  });

  it("quem sai some da lista, e o host avisa todos", () => {
    let { estado } = reduzir(salaDoHost(), 2, { tipo: "oi", personagem: vitor }, 0);
    const saida = reduzir(estado, 2, { tipo: "saiu" }, 0);
    estado = saida.estado;
    expect(estado.jogadores).toEqual([]);
    expect(saida.enviar[0]).toMatchObject({ tipo: "sala", jogadores: [] });
  });

  it("se o host sai, o convidado sai da sala com um aviso", () => {
    const comHost = reduzir(salaDoConvidado(), 1, { tipo: "sala", jogadores: [], musica: { tipo: "embutida", id: "x" }, dificuldade: "medio", prontos: [] }, 0).estado;
    expect(reduzir(comHost, 1, { tipo: "saiu" }, 0).sair).toBe("O host fechou a sala.");
  });

  it(`sala cheia (${MAXIMO_DE_JOGADORES} jogadores) avisa e sai`, () => {
    expect(reduzir(estadoInicial(vitor, false), 0, { tipo: "cheia" }, 0).sair).toMatch(/4 jogadores/);
  });

  it("código de sala online que não existe avisa e sai", () => {
    expect(reduzir(estadoInicial(vitor, false), 0, { tipo: "semSala" }, 0).sair).toMatch(/Sala não encontrada/);
  });

  it("o relay manda o código junto do bem-vindo, e a sala segue igual", () => {
    const { estado } = reduzir(estadoInicial(vitor, true), 0, { tipo: "bemVindo", id: 1, codigo: "ABCDE" }, 0);
    expect(estado).toMatchObject({ status: "naSala", meuId: 1, hostId: 1 });
  });

  it("o começo da partida marca o mesmo instante de largada para todos", () => {
    const { estado } = reduzir(salaDoConvidado(), 1, { tipo: "comecar", musica: { tipo: "embutida", id: "overdrive" }, dificuldade: "dificil" }, 1000);
    expect(estado).toMatchObject({ status: "jogando", partidas: 1, inicio: 1000 + ATRASO_DO_INICIO_MS, dificuldade: "dificil", adversarios: {} });
  });

  it("guarda o estado dos adversários, mas não o próprio", () => {
    let { estado } = reduzir(salaDoConvidado(), 1, { tipo: "estado", ...jogada }, 0);
    estado = reduzir(estado, 2, { tipo: "estado", ...jogada, pontos: 999 }, 0).estado;
    expect(estado.adversarios).toEqual({ 1: jogada });
  });
});

describe("ações do host", () => {
  it("escolher a música atualiza a sala de todos", () => {
    const { estado, enviar } = escolherMusica(salaDoHost(), { tipo: "embutida", id: "overdrive" }, "expert");
    expect(estado.musica).toEqual({ tipo: "embutida", id: "overdrive" });
    expect(enviar[0]).toMatchObject({ tipo: "sala", dificuldade: "expert" });
  });

  it("só o host escolhe a música", () => {
    expect(escolherMusica(salaDoConvidado(), { tipo: "embutida", id: "overdrive" }, "expert").enviar).toEqual([]);
  });

  describe("pronto", () => {
    const overdrive = { tipo: "embutida", id: "overdrive" } as const;
    /** Host com dois convidados (2 e 3) na sala, tocando a overdrive. */
    function salaCheia(): EstadoDaSala {
      let estado = escolherMusica(salaDoHost(), overdrive, "medio").estado;
      for (const [id, personagem] of [[1, lucas], [2, vitor], [3, vitor]] as const) estado = reduzir(estado, id, { tipo: "oi", personagem }, 0).estado;
      return estado;
    }
    const pronto = (estado: EstadoDaSala, de: number, valor = true, musicaId = "overdrive") => reduzir(estado, de, { tipo: "pronto", musicaId, pronto: valor }, 0);

    it("o host marca quem ficou pronto e avisa todos", () => {
      const { estado, enviar } = pronto(salaCheia(), 2);
      expect(estado.prontos).toEqual([2]);
      expect(enviar[0]).toMatchObject({ tipo: "sala", prontos: [2] });
    });

    it("pronto para outra música não conta: o jogador ainda não baixou a atual", () => {
      expect(pronto(salaCheia(), 2, true, "outra").estado.prontos).toEqual([]);
    });

    it("dá para desmarcar", () => {
      expect(pronto(pronto(salaCheia(), 2).estado, 2, false).estado.prontos).toEqual([]);
    });

    it("o convidado adota a lista de prontos do host", () => {
      const { estado } = reduzir(salaDoConvidado(), 1, { tipo: "sala", jogadores: [], musica: overdrive, dificuldade: "medio", prontos: [2, 3] }, 0);
      expect(estado.prontos).toEqual([2, 3]);
    });

    it("só começa com todos os convidados prontos (o host não precisa)", () => {
      const umPronto = pronto(salaCheia(), 2).estado;
      expect(todosProntos(umPronto)).toBe(false);
      expect(comecarPartida(umPronto)).toEqual([]);
      const todos = pronto(umPronto, 3).estado;
      expect(todosProntos(todos)).toBe(true);
      expect(comecarPartida(todos)).toEqual([{ tipo: "comecar", musica: overdrive, dificuldade: "medio" }]);
    });

    it("trocar a música zera os prontos, porque todos precisam baixar a nova", () => {
      const { estado, enviar } = escolherMusica(pronto(salaCheia(), 2).estado, { tipo: "embutida", id: "cosmic-riff" }, "medio");
      expect(estado.prontos).toEqual([]);
      expect(enviar[0]).toMatchObject({ prontos: [] });
    });

    it("trocar só a dificuldade mantém os prontos", () => {
      expect(escolherMusica(pronto(salaCheia(), 2).estado, overdrive, "expert").estado.prontos).toEqual([2]);
    });

    it("quem sai deixa de contar", () => {
      const { estado } = reduzir(pronto(pronto(salaCheia(), 2).estado, 3).estado, 3, { tipo: "saiu" }, 0);
      expect(estado.prontos).toEqual([2]);
      expect(todosProntos(estado)).toBe(true);
    });

    it("depois da largada, todos precisam ficar prontos de novo para a próxima", () => {
      const { estado } = reduzir(pronto(salaCheia(), 2).estado, 1, { tipo: "comecar", musica: overdrive, dificuldade: "medio" }, 0);
      expect(estado.prontos).toEqual([]);
    });
  });

  it("começar a partida avisa todos com a música e a dificuldade", () => {
    expect(comecarPartida(salaDoHost())).toEqual([{ tipo: "comecar", musica: salaDoHost().musica, dificuldade: salaDoHost().dificuldade }]);
    expect(comecarPartida(salaDoConvidado())).toEqual([]);
  });
});
