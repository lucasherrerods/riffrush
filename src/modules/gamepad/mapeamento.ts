/** Índices do layout padrão da Gamepad API (Xbox e afins). */
export const BOTOES = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  SELECT: 8,
  START: 9,
  CIMA: 12,
  BAIXO: 13,
  ESQUERDA: 14,
  DIREITA: 15,
} as const;

/** Verde, vermelho, amarelo, azul e laranja. */
const TRASTES = [BOTOES.LT, BOTOES.LB, BOTOES.RB, BOTOES.RT, BOTOES.A];
export const ROTULOS_DOS_TRASTES = ["LT", "LB", "RB", "RT", "A"];
export const ROTULO_DA_ESTRELA = "Select";
const PALHETADAS = [BOTOES.CIMA, BOTOES.BAIXO];
const SETAS: Record<number, string> = {
  [BOTOES.CIMA]: "ArrowUp",
  [BOTOES.BAIXO]: "ArrowDown",
  [BOTOES.ESQUERDA]: "ArrowLeft",
  [BOTOES.DIREITA]: "ArrowRight",
};

export type Modo = "jogo" | "menu";

/** Cima, baixo, esquerda e direita: a mesma ordem dos botões do direcional. */
export const DIRECIONAL = [BOTOES.CIMA, BOTOES.BAIXO, BOTOES.ESQUERDA, BOTOES.DIREITA];
/** Aperta depois do meio do curso e só solta perto do centro, para o analógico tremendo não apertar de novo. */
const LIMIAR_PARA_APERTAR = 0.5;
const LIMIAR_PARA_SOLTAR = 0.3;

/** Lê o analógico esquerdo (eixos 0 e 1) como o direcional. Na diagonal vale o eixo mais inclinado. */
export function direcoesDoAnalogico(eixos: readonly number[], antes: readonly boolean[]): boolean[] {
  const [x = 0, y = 0] = eixos;
  const horizontal = Math.abs(x) > Math.abs(y);
  const inclinacoes = [horizontal ? 0 : -y, horizontal ? 0 : y, horizontal ? -x : 0, horizontal ? x : 0];
  return inclinacoes.map((inclinacao, i) => inclinacao > (antes[i] ? LIMIAR_PARA_SOLTAR : LIMIAR_PARA_APERTAR));
}

/** Nos menus o analógico vale como o direcional. No jogo, não: o direcional palheta. */
export function juntarAnalogico(botoes: readonly boolean[], direcoes: readonly boolean[], modo: Modo): boolean[] {
  const juntos = [...botoes];
  if (modo === "menu") DIRECIONAL.forEach((botao, i) => (juntos[botao] = Boolean(botoes[botao]) || direcoes[i]));
  return juntos;
}

export interface Mapa {
  teclas: string[];
  teclaDaEstrela: string;
}

export interface EventoDeTecla {
  tipo: "keydown" | "keyup";
  code: string;
}

function teclasDoBotao(botao: number, modo: Modo, mapa: Mapa): string[] {
  if (SETAS[botao]) return [SETAS[botao]];
  if (modo === "menu") {
    if (botao === BOTOES.A || botao === BOTOES.START) return ["Enter"];
    if (botao === BOTOES.B) return ["Escape"];
    return [];
  }
  const pista = TRASTES.indexOf(botao as (typeof TRASTES)[number]);
  // A também confirma, para o menu de pausa; o jogo ignora o Enter.
  if (pista >= 0) return botao === BOTOES.A ? [mapa.teclas[pista], "Enter"] : [mapa.teclas[pista]];
  if (botao === BOTOES.SELECT) return [mapa.teclaDaEstrela];
  if (botao === BOTOES.START) return ["Escape"];
  return [];
}

/**
 * Compara dois quadros do controle e diz quais teclas apertar e soltar.
 * `emitidos` guarda o que cada botão apertou, para soltar a mesma tecla mesmo se o modo mudar.
 */
export function traduzir(antes: boolean[], agora: boolean[], emitidos: string[][], modo: Modo, mapa: Mapa) {
  const eventos: EventoDeTecla[] = [];
  const novos = emitidos.map((codes) => [...codes]);

  agora.forEach((apertado, botao) => {
    if (apertado === Boolean(antes[botao])) return;
    if (apertado) {
      novos[botao] = teclasDoBotao(botao, modo, mapa);
      for (const code of novos[botao]) eventos.push({ tipo: "keydown", code });
    } else {
      for (const code of novos[botao] ?? []) eventos.push({ tipo: "keyup", code });
      novos[botao] = [];
    }
  });

  const palhetou = modo === "jogo" && PALHETADAS.some((b) => agora[b] && !antes[b]);
  if (palhetou) {
    TRASTES.forEach((botao, pista) => {
      if (!antes[botao] || !agora[botao]) return;
      const code = mapa.teclas[pista];
      eventos.push({ tipo: "keyup", code }, { tipo: "keydown", code });
    });
  }
  return { eventos, emitidos: novos };
}
