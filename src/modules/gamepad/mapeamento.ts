/** Índices do layout padrão da Gamepad API (Xbox e afins). */
export const BOTOES = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  SELECT: 8,
  START: 9,
  CIMA: 12,
  BAIXO: 13,
  ESQUERDA: 14,
  DIREITA: 15,
} as const;

/** Verde, vermelho, amarelo, azul e laranja, como no Clone Hero. */
const TRASTES = [BOTOES.A, BOTOES.B, BOTOES.Y, BOTOES.X, BOTOES.LB];
const PALHETADAS = [BOTOES.CIMA, BOTOES.BAIXO];
const SETAS: Record<number, string> = {
  [BOTOES.CIMA]: "ArrowUp",
  [BOTOES.BAIXO]: "ArrowDown",
  [BOTOES.ESQUERDA]: "ArrowLeft",
  [BOTOES.DIREITA]: "ArrowRight",
};

export type Modo = "jogo" | "menu";

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
