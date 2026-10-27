import { comAlfa } from "@/shared/styles/tokens";
import { CORES_DA_PISTA, CORES_DOS_JULGAMENTOS, coresDasColunas } from "../tema";
import { notasVisiveis, yDaNota, type GeometriaDaPista } from "./pista";

/** Estado de cada nota para o desenho, montado a partir dos eventos do motor. */
export const ESPERANDO = 0;
export const SEGURANDO = 1;
export const TERMINADA = 2;

export const NOMES_DOS_JULGAMENTOS = ["MAX", "300", "200", "100", "50", "MISS"];

const JULGAMENTO_MISS = 5;
/** Por quanto tempo o último julgamento fica na tela. */
const DURACAO_DO_JULGAMENTO_MS = 400;

/**
 * Aplica os eventos do motor (grupos de cinco: nota, coluna, julgamento, ponta, desvio) no estado das notas.
 * Devolve o último julgamento, para o HUD.
 */
export function aplicarEventos(estados: Uint8Array, notas: ArrayLike<number>, eventos: ArrayLike<number>): number | undefined {
  let ultimo: number | undefined;
  for (let i = 0; i < eventos.length; i += 5) {
    const nota = eventos[i];
    const julgamento = eventos[i + 2];
    const ponta = eventos[i + 3] === 1;
    const longa = notas[nota * 3 + 2] >= 0;
    estados[nota] = !ponta && longa && julgamento !== JULGAMENTO_MISS ? SEGURANDO : TERMINADA;
    ultimo = julgamento;
  }
  return ultimo;
}

export interface QuadroDaPista {
  agoraMs: number;
  rolagemMs: number;
  /** Trios [coluna, tempo, fim] do motor. */
  notas: ArrayLike<number>;
  estados: Uint8Array;
  apertadas: boolean[];
  julgamento?: { codigo: number; emMs: number };
  combo: number;
  vida: number;
}

export function desenharPista(c: CanvasRenderingContext2D, g: GeometriaDaPista, q: QuadroDaPista) {
  const { x, larguraDaColuna: largura, teclas, yDoJulgamento, altura } = g;
  const larguraDaPista = largura * teclas;
  const corDas = coresDasColunas(teclas);
  c.clearRect(0, 0, c.canvas.width, c.canvas.height);

  for (let coluna = 0; coluna < teclas; coluna++) {
    c.fillStyle = coluna % 2 ? CORES_DA_PISTA.colunaAlternada : CORES_DA_PISTA.fundo;
    c.fillRect(x + coluna * largura, 0, largura, altura);
    if (q.apertadas[coluna]) {
      const luz = c.createLinearGradient(0, yDoJulgamento, 0, yDoJulgamento - altura * 0.4);
      luz.addColorStop(0, comAlfa(corDas[coluna], 0.28));
      luz.addColorStop(1, comAlfa(corDas[coluna], 0));
      c.fillStyle = luz;
      c.fillRect(x + coluna * largura, 0, largura, yDoJulgamento);
    }
  }
  c.fillStyle = CORES_DA_PISTA.divisoria;
  for (let coluna = 0; coluna <= teclas; coluna++) c.fillRect(x + coluna * largura - 0.5, 0, 1, altura);

  const altaDaNota = Math.max(10, Math.round(largura * 0.28));
  const margemMs = (q.rolagemMs * (altura - yDoJulgamento)) / yDoJulgamento;
  for (const i of notasVisiveis(q.notas, q.agoraMs, q.rolagemMs, margemMs)) {
    if (q.estados[i] === TERMINADA) continue;
    const coluna = q.notas[i * 3];
    const tempo = q.notas[i * 3 + 1];
    const fim = q.notas[i * 3 + 2];
    const xDaNota = x + coluna * largura + 2;
    const cor = corDas[coluna];
    // A nota segurada fica presa na linha de julgamento até a ponta.
    const yCabeca = q.estados[i] === SEGURANDO ? yDoJulgamento : yDaNota(tempo, q.agoraMs, q.rolagemMs, yDoJulgamento);
    if (fim >= 0) {
      const yPonta = yDaNota(fim, q.agoraMs, q.rolagemMs, yDoJulgamento);
      c.fillStyle = comAlfa(cor, q.estados[i] === SEGURANDO ? 0.75 : 0.45);
      c.fillRect(xDaNota + largura * 0.15, yPonta, largura * 0.7 - 4, yCabeca - yPonta);
    }
    c.shadowColor = cor;
    c.shadowBlur = 8;
    c.fillStyle = cor;
    c.fillRect(xDaNota, yCabeca - altaDaNota, largura - 4, altaDaNota);
    c.shadowBlur = 0;
  }

  for (let coluna = 0; coluna < teclas; coluna++) {
    c.fillStyle = q.apertadas[coluna] ? corDas[coluna] : CORES_DA_PISTA.receptor;
    c.fillRect(x + coluna * largura + 2, yDoJulgamento, largura - 4, Math.max(6, altaDaNota * 0.6));
  }
  c.fillStyle = CORES_DA_PISTA.linhaDeJulgamento;
  c.fillRect(x, yDoJulgamento - 1, larguraDaPista, 2);

  // Vida: uma barra fina na lateral direita da pista.
  const alturaDaVida = altura * 0.5;
  c.fillStyle = CORES_DA_PISTA.fundoDaVida;
  c.fillRect(x + larguraDaPista + 8, yDoJulgamento - alturaDaVida, 6, alturaDaVida);
  c.fillStyle = CORES_DA_PISTA.vida;
  c.fillRect(x + larguraDaPista + 8, yDoJulgamento - alturaDaVida * q.vida, 6, alturaDaVida * q.vida);

  const centro = x + larguraDaPista / 2;
  c.textAlign = "center";
  if (q.combo > 0) {
    c.fillStyle = comAlfa(CORES_DA_PISTA.linhaDeJulgamento, 0.85);
    c.font = `${Math.round(largura * 0.55)}px "Bebas Neue", sans-serif`;
    c.fillText(String(q.combo), centro, altura * 0.38);
  }
  const passado = q.julgamento ? q.agoraMs - q.julgamento.emMs : Infinity;
  if (q.julgamento && passado < DURACAO_DO_JULGAMENTO_MS) {
    c.globalAlpha = 1 - passado / DURACAO_DO_JULGAMENTO_MS;
    c.fillStyle = CORES_DOS_JULGAMENTOS[q.julgamento.codigo];
    c.font = `${Math.round(largura * 0.5)}px "Bebas Neue", sans-serif`;
    c.fillText(NOMES_DOS_JULGAMENTOS[q.julgamento.codigo], centro, altura * 0.5);
    c.globalAlpha = 1;
  }
}
