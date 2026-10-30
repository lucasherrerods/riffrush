import { marcarComoDoControle, registrarUso } from "./dispositivo";
import { alvoDaTecla, ativarFoco, moverFoco, type Direcao } from "./foco";
import { DIRECIONAL, direcoesDoAnalogico, juntarAnalogico, podeSerEscolhido, traduzir, type Mapa, type Modo } from "./mapeamento";

interface Opcoes {
  modo: () => Modo;
  mapa: () => Mapa;
}

/** Mais fino que um quadro (~16 ms): o acerto fica com o instante mais preciso. */
const INTERVALO_MS = 5;
/** Nos menus, segurar uma direção repete a seta, como segurar a tecla no teclado. */
const ATRASO_DA_REPETICAO_MS = 400;
const INTERVALO_DA_REPETICAO_MS = 120;

const DIRECAO_DA_SETA: Record<string, Direcao> = { ArrowUp: "cima", ArrowDown: "baixo", ArrowLeft: "esquerda", ArrowRight: "direita" };

const apertar = (tipo: "keydown" | "keyup", code: string, modo: Modo, repeat = false) => {
  const evento = new KeyboardEvent(tipo, { code, key: code, repeat, bubbles: true, cancelable: true });
  marcarComoDoControle(evento);
  registrarUso("controle");
  alvoDaTecla().dispatchEvent(evento);
  // Tecla criada pelo código não clica nem move o foco sozinha. Nos menus, se nenhuma tela a tratou, faz o que o teclado faria.
  if (modo !== "menu" || tipo !== "keydown" || evento.defaultPrevented) return;
  if (code === "Enter") ativarFoco();
  else if (DIRECAO_DA_SETA[code]) moverFoco(DIRECAO_DA_SETA[code]);
};

let aoCapturar: ((botao: number) => void) | null = null;

/**
 * O próximo botão que o jogador apertar vai para `aoEscolher`, em vez de virar tecla.
 * Assim, escolher o A para um traste não aperta também o Enter da tela. Devolve como cancelar.
 */
export function capturarBotao(aoEscolher: (botao: number) => void) {
  aoCapturar = aoEscolher;
  return () => {
    if (aoCapturar === aoEscolher) aoCapturar = null;
  };
}

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
    if (aoCapturar) {
      const escolhido = agora.findIndex((apertado, botao) => apertado && !antes[botao] && podeSerEscolhido(botao));
      if (escolhido >= 0) {
        const escolher = aoCapturar;
        aoCapturar = null;
        registrarUso("controle");
        escolher(escolhido);
      }
      // O botão escolhido continua apertado: o próximo quadro já o vê como segurado e não o transforma em tecla.
      antes = agora;
      return;
    }
    const traducao = traduzir(antes, agora, emitidos, modoAtual, mapa());
    for (const { tipo, code } of traducao.eventos) apertar(tipo, code, modoAtual);

    for (const botao of DIRECIONAL) {
      if (!agora[botao] || modoAtual !== "menu") proximaRepeticao.delete(botao);
      else if (!antes[botao] || !proximaRepeticao.has(botao)) proximaRepeticao.set(botao, decorrido + ATRASO_DA_REPETICAO_MS);
      else if (decorrido >= proximaRepeticao.get(botao)!) {
        for (const code of traducao.emitidos[botao] ?? []) apertar("keydown", code, modoAtual, true);
        proximaRepeticao.set(botao, decorrido + INTERVALO_DA_REPETICAO_MS);
      }
    }

    antes = agora;
    emitidos = traducao.emitidos;
  };
  const relogio = setInterval(ler, INTERVALO_MS);
  return () => clearInterval(relogio);
}
