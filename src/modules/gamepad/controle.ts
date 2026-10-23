import { DIRECIONAL, direcoesDoAnalogico, juntarAnalogico, traduzir, type Mapa, type Modo } from "./mapeamento";

interface Opcoes {
  modo: () => Modo;
  mapa: () => Mapa;
}

/** Mais fino que um quadro (~16 ms): o acerto fica com o instante mais preciso. */
const INTERVALO_MS = 5;
/** Nos menus, segurar uma direção repete a seta, como segurar a tecla no teclado. */
const ATRASO_DA_REPETICAO_MS = 400;
const INTERVALO_DA_REPETICAO_MS = 120;

const apertar = (tipo: "keydown" | "keyup", code: string, repeat = false) =>
  window.dispatchEvent(new KeyboardEvent(tipo, { code, key: code, repeat, bubbles: true, cancelable: true }));

/** Lê o controle e transforma os botões em teclas, então todo o jogo funciona sem mudar nada. */
export function iniciarControle({ modo, mapa }: Opcoes) {
  let antes: boolean[] = [];
  let emitidos: string[][] = [];
  let direcoes = [false, false, false, false];
  let decorrido = 0;
  const proximaRepeticao = new Map<number, number>();

  const ler = () => {
    decorrido += INTERVALO_MS;
    const controle = Array.from(navigator.getGamepads?.() ?? []).find((c) => c);
    const modoAtual = modo();
    direcoes = direcoesDoAnalogico(controle?.axes ?? [], direcoes);
    const agora = juntarAnalogico(controle ? controle.buttons.map((b) => b.pressed) : [], direcoes, modoAtual);
    const traducao = traduzir(antes, agora, emitidos, modoAtual, mapa());
    for (const { tipo, code } of traducao.eventos) apertar(tipo, code);

    for (const botao of DIRECIONAL) {
      if (!agora[botao] || modoAtual !== "menu") proximaRepeticao.delete(botao);
      else if (!antes[botao] || !proximaRepeticao.has(botao)) proximaRepeticao.set(botao, decorrido + ATRASO_DA_REPETICAO_MS);
      else if (decorrido >= proximaRepeticao.get(botao)!) {
        for (const code of traducao.emitidos[botao] ?? []) apertar("keydown", code, true);
        proximaRepeticao.set(botao, decorrido + INTERVALO_DA_REPETICAO_MS);
      }
    }

    antes = agora;
    emitidos = traducao.emitidos;
  };
  const relogio = setInterval(ler, INTERVALO_MS);
  return () => clearInterval(relogio);
}
