import { marcarComoDoControle } from "@/modules/gamepad";
import { OPCOES_PADRAO_DA_PARTIDA } from "@/modules/rock/gameplay";
import { LAYOUTS_DO_TECLADO, MAXIMO_DE_JOGADORES, avisoDeRollover, dispositivoDaTecla, entrar, eventoDoJogador, opcoesDoJogador, sair, type DispositivoDoJogador } from "./dispositivos";

const tecla = (code: string, controle?: number) => {
  const evento = new KeyboardEvent("keydown", { code });
  if (controle !== undefined) marcarComoDoControle(evento, controle);
  return evento;
};
const ESQUERDA: DispositivoDoJogador = { tipo: "teclado", lado: "esquerda" };
const DIREITA: DispositivoDoJogador = { tipo: "teclado", lado: "direita" };
const controle = (indice: number): DispositivoDoJogador => ({ tipo: "controle", indice });

describe("layouts do teclado", () => {
  it("os dois lados não dividem nenhuma tecla", () => {
    const teclasDe = (l: (typeof LAYOUTS_DO_TECLADO)["esquerda"]) => [...l.teclas, l.teclaDaEstrela, l.teclaDaPalheta];
    const esquerda = teclasDe(LAYOUTS_DO_TECLADO.esquerda);
    expect(teclasDe(LAYOUTS_DO_TECLADO.direita).filter((t) => esquerda.includes(t))).toEqual([]);
    expect(LAYOUTS_DO_TECLADO.esquerda.teclas).toHaveLength(OPCOES_PADRAO_DA_PARTIDA.teclas.length);
  });
});

describe("eventoDoJogador", () => {
  it("o jogador do teclado só ouve o teclado de verdade", () => {
    expect(eventoDoJogador(tecla("KeyA"), ESQUERDA)).toBe(true);
    expect(eventoDoJogador(tecla("KeyA", 0), ESQUERDA)).toBe(false);
  });

  it("o jogador do controle só ouve o próprio controle", () => {
    expect(eventoDoJogador(tecla("KeyA", 1), controle(1))).toBe(true);
    expect(eventoDoJogador(tecla("KeyA", 0), controle(1))).toBe(false);
    expect(eventoDoJogador(tecla("KeyA"), controle(1))).toBe(false);
  });
});

describe("opcoesDoJogador", () => {
  it("no teclado troca as teclas pelas do lado e tira os rótulos do controle", () => {
    const opcoes = opcoesDoJogador({ ...OPCOES_PADRAO_DA_PARTIDA, rotulosDosTrastes: ["LT"] }, DIREITA);
    expect(opcoes.teclas).toEqual(LAYOUTS_DO_TECLADO.direita.teclas);
    expect(opcoes.teclaDaEstrela).toBe(LAYOUTS_DO_TECLADO.direita.teclaDaEstrela);
    expect(opcoes.rotulosDosTrastes).toBeUndefined();
  });

  it("no controle mantém o mapeamento das configurações", () => {
    expect(opcoesDoJogador(OPCOES_PADRAO_DA_PARTIDA, controle(0))).toEqual(OPCOES_PADRAO_DA_PARTIDA);
  });
});

describe("dispositivoDaTecla", () => {
  it("reconhece o lado do teclado pelas teclas dele e o controle por qualquer botão", () => {
    expect(dispositivoDaTecla(tecla(LAYOUTS_DO_TECLADO.esquerda.teclas[0]))).toEqual(ESQUERDA);
    expect(dispositivoDaTecla(tecla(LAYOUTS_DO_TECLADO.direita.teclaDaEstrela))).toEqual(DIREITA);
    expect(dispositivoDaTecla(tecla("Enter", 2))).toEqual(controle(2));
    expect(dispositivoDaTecla(tecla("Digit1"))).toBeNull();
  });
});

describe("entrar e sair", () => {
  it("cada dispositivo entra uma vez só, até o máximo de jogadores", () => {
    let jogadores = entrar([], ESQUERDA);
    jogadores = entrar(jogadores, ESQUERDA);
    expect(jogadores).toEqual([ESQUERDA]);
    for (let i = 0; i < 5; i++) jogadores = entrar(jogadores, controle(i));
    expect(jogadores).toHaveLength(MAXIMO_DE_JOGADORES);
  });

  it("sair tira só aquele dispositivo", () => {
    expect(sair([ESQUERDA, controle(1), DIREITA], controle(1))).toEqual([ESQUERDA, DIREITA]);
  });
});

describe("avisoDeRollover", () => {
  it("avisa só com dois jogadores no mesmo teclado", () => {
    expect(avisoDeRollover([ESQUERDA, controle(0)])).toBe(false);
    expect(avisoDeRollover([ESQUERDA, DIREITA])).toBe(true);
  });
});
