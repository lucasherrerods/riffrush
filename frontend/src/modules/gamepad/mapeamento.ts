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

/** Os botões do jogo quando o jogador não escolheu outros: verde, vermelho, amarelo, azul, laranja e a nota aberta, e o star power. */
export const BOTOES_DOS_TRASTES_PADRAO = [BOTOES.LT, BOTOES.LB, BOTOES.RB, BOTOES.RT, BOTOES.A, BOTOES.X];
export const BOTAO_DA_ESTRELA_PADRAO = BOTOES.SELECT;

const NOMES_DOS_BOTOES: Record<number, string> = {
  [BOTOES.A]: "A",
  [BOTOES.B]: "B",
  [BOTOES.X]: "X",
  [BOTOES.Y]: "Y",
  [BOTOES.LB]: "LB",
  [BOTOES.RB]: "RB",
  [BOTOES.LT]: "LT",
  [BOTOES.RT]: "RT",
  [BOTOES.SELECT]: "Select",
  [BOTOES.START]: "Start",
  10: "L3",
  11: "R3",
  16: "Guia",
};

/** O nome que aparece na tela. Controles fora do padrão têm botões sem nome conhecido. */
export const nomeDoBotao = (botao: number) => NOMES_DOS_BOTOES[botao] ?? `Botão ${botao + 1}`;

const PALHETADAS: number[] = [BOTOES.CIMA, BOTOES.BAIXO];
/** A tecla que o direcional aperta no jogo quando o jeito é a palhetada. Não existe no teclado, então não se confunde com o Enter do A. */
export const PALHETA_DO_CONTROLE = "Palheta";
const SETAS: Record<number, string> = {
  [BOTOES.CIMA]: "ArrowUp",
  [BOTOES.BAIXO]: "ArrowDown",
  [BOTOES.ESQUERDA]: "ArrowLeft",
  [BOTOES.DIREITA]: "ArrowRight",
};

export type Modo = "jogo" | "menu";

/** Cima, baixo, esquerda e direita: a mesma ordem dos botões do direcional. */
export const DIRECIONAL = [BOTOES.CIMA, BOTOES.BAIXO, BOTOES.ESQUERDA, BOTOES.DIREITA];

/** O direcional palheta e navega, e o Start pausa: esses não viram traste nem star power. */
export const podeSerEscolhido = (botao: number) => !DIRECIONAL.includes(botao as (typeof DIRECIONAL)[number]) && botao !== BOTOES.START;
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
  /** Índices dos botões do controle de cada traste, na mesma ordem das teclas. */
  botoesDoControle: number[];
  botaoDaEstrela: number;
  /** Na palhetada, o direcional vira a palheta em vez de tocar de novo os trastes segurados. */
  jeitoDeJogar?: string;
}

export interface EventoDeTecla {
  tipo: "keydown" | "keyup";
  code: string;
}

function teclasDoBotao(botao: number, modo: Modo, mapa: Mapa): string[] {
  if (modo === "jogo" && mapa.jeitoDeJogar === "palhetada" && PALHETADAS.includes(botao)) return [PALHETA_DO_CONTROLE];
  if (SETAS[botao]) return [SETAS[botao]];
  if (modo === "menu") {
    if (botao === BOTOES.A || botao === BOTOES.START) return ["Enter"];
    if (botao === BOTOES.B) return ["Escape"];
    if (botao === BOTOES.Y) return ["Tab"];
    return [];
  }
  const teclas: string[] = [];
  const pista = mapa.botoesDoControle.indexOf(botao);
  if (pista >= 0) teclas.push(mapa.teclas[pista]);
  if (botao === mapa.botaoDaEstrela) teclas.push(mapa.teclaDaEstrela);
  // A também confirma, para o menu de pausa; o jogo ignora o Enter.
  if (botao === BOTOES.A) teclas.push("Enter");
  if (botao === BOTOES.START) teclas.push("Escape");
  return teclas;
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

  const palhetou = modo === "jogo" && mapa.jeitoDeJogar !== "palhetada" && PALHETADAS.some((b) => agora[b] && !antes[b]);
  if (palhetou) {
    mapa.botoesDoControle.forEach((botao, pista) => {
      if (!antes[botao] || !agora[botao]) return;
      const code = mapa.teclas[pista];
      eventos.push({ tipo: "keyup", code }, { tipo: "keydown", code });
    });
  }
  return { eventos, emitidos: novos };
}
