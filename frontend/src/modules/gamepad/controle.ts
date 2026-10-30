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

const apertar = (indice: number, tipo: "keydown" | "keyup", code: string, modo: Modo, repeat = false) => {
  const evento = new KeyboardEvent(tipo, { code, key: code, repeat, bubbles: true, cancelable: true });
  marcarComoDoControle(evento, indice);
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

interface EstadoDoControle {
  antes: boolean[];
  emitidos: string[][];
  direcoes: boolean[];
  proximaRepeticao: Map<number, number>;
}

const estadoNovo = (): EstadoDoControle => ({ antes: [], emitidos: [], direcoes: [false, false, false, false], proximaRepeticao: new Map() });

/**
 * Lê os controles e transforma os botões em teclas, então todo o jogo funciona sem mudar nada.
 * Cada controle tem o próprio estado, e as teclas dele saem marcadas com o índice, para a tela dividida separar os jogadores.
 */
export function iniciarControle({ modo, mapa }: Opcoes) {
  const estados = new Map<number, EstadoDoControle>();
  let decorrido = 0;

  const lerControle = (controle: Gamepad, indice: number, modoAtual: Modo) => {
    const estado = estados.get(indice) ?? estadoNovo();
    estados.set(indice, estado);
    const { antes } = estado;
    estado.direcoes = direcoesDoAnalogico(controle.axes ?? [], estado.direcoes);
    const agora = juntarAnalogico(controle.buttons.map((b) => b.pressed), estado.direcoes, modoAtual);
    if (aoCapturar) {
      const escolhido = agora.findIndex((apertado, botao) => apertado && !antes[botao] && podeSerEscolhido(botao));
      if (escolhido >= 0) {
        const escolher = aoCapturar;
        aoCapturar = null;
        registrarUso("controle");
        escolher(escolhido);
      }
      // O botão escolhido continua apertado: o próximo quadro já o vê como segurado e não o transforma em tecla.
      estado.antes = agora;
      return;
    }
    const traducao = traduzir(antes, agora, estado.emitidos, modoAtual, mapa());
    for (const { tipo, code } of traducao.eventos) apertar(indice, tipo, code, modoAtual);

    for (const botao of DIRECIONAL) {
      if (!agora[botao] || modoAtual !== "menu") estado.proximaRepeticao.delete(botao);
      else if (!antes[botao] || !estado.proximaRepeticao.has(botao)) estado.proximaRepeticao.set(botao, decorrido + ATRASO_DA_REPETICAO_MS);
      else if (decorrido >= estado.proximaRepeticao.get(botao)!) {
        for (const code of traducao.emitidos[botao] ?? []) apertar(indice, "keydown", code, modoAtual, true);
        estado.proximaRepeticao.set(botao, decorrido + INTERVALO_DA_REPETICAO_MS);
      }
    }

    estado.antes = agora;
    estado.emitidos = traducao.emitidos;
  };

  const ler = () => {
    decorrido += INTERVALO_MS;
    const modoAtual = modo();
    const vistos = new Set<number>();
    Array.from(navigator.getGamepads?.() ?? []).forEach((controle, posicao) => {
      if (!controle) return;
      const indice = controle.index ?? posicao;
      vistos.add(indice);
      lerControle(controle, indice, modoAtual);
    });
    // O controle desligado com um botão apertado solta as teclas dele, para nada ficar preso.
    for (const indice of [...estados.keys()].filter((i) => !vistos.has(i))) {
      const solto = estados.get(indice)!.antes.map(() => ({ pressed: false }));
      lerControle({ buttons: solto, axes: [] } as unknown as Gamepad, indice, modoAtual);
      estados.delete(indice);
    }
  };
  const relogio = setInterval(ler, INTERVALO_MS);
  return () => clearInterval(relogio);
}
