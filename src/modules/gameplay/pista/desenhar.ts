import type { Batida } from "@/modules/songs";
import { cores, comAlfa } from "@/shared/styles/tokens";
import { CORES_DAS_PISTAS, CORES_DO_MULTIPLICADOR, COR_DA_ESTRELA, COR_DA_NOTA_PERDIDA, TRILHO_DA_ESTRELA } from "../cores";
import type { NotaEmJogo } from "../partida";
import { pontosDoRaio, tremor } from "./efeitos";
import { layoutDaPista, projetar, xDaPista } from "./geometria";

export interface Cena {
  notas: NotaEmJogo[];
  primeira: number;
  batidas: Batida[];
  apertados: boolean[];
  explosoes: { pista: number; tempo: number }[];
  estrelaAtiva: boolean;
  multiplicador: number;
  frasesFalhas: Set<number>;
  /** Trovões dos marcos de combo: instante, força (1 a 3) e semente do desenho dos raios. */
  trovoes: { tempo: number; forca: number; semente: number }[];
  /** Instante em que o star power foi solto, para o tremor da pista. */
  estrelaDesde: number | null;
}

/** Imagens pré-desenhadas das notas e dos brilhos (ver sprites.ts). */
export interface Sprites {
  nota(cor: string, estrela: boolean, brilho: boolean): CanvasImageSource;
  brilho(cor: string): CanvasImageSource;
}

/** Tamanho do sprite de nota comparado com o raio da nota. */
export const SPRITE_DA_NOTA = { raio: 56, largura: 160, altura: 110 };
const DURACAO_DA_EXPLOSAO = 0.3;
const DURACAO_DO_TROVAO = 0.5;
const ATRAS_DA_LINHA = -0.12;

let gradienteDaPista: { chave: string; valor: CanvasGradient } | null = null;

/** Primeiro índice com tempo >= alvo, numa lista ordenada. */
function primeiroAPartirDe(lista: { tempo: number }[], alvo: number) {
  let baixo = 0;
  let alto = lista.length;
  while (baixo < alto) {
    const meio = (baixo + alto) >> 1;
    if (lista[meio].tempo < alvo) baixo = meio + 1;
    else alto = meio;
  }
  return baixo;
}

export function desenharPista(
  c: CanvasRenderingContext2D,
  largura: number,
  altura: number,
  tempo: number,
  antecedencia: number,
  cena: Cena,
  efeitos: boolean,
  sprites: Sprites,
) {
  c.clearRect(0, 0, largura, altura);
  const layout = layoutDaPista(largura, altura);
  const { centro, linhaDeBatida, larguraDoTraste } = layout;

  // O tremor do star power gira e desloca a pista em torno da linha de batida.
  const sacudida = efeitos && cena.estrelaDesde !== null ? tremor(tempo - cena.estrelaDesde) : null;
  const tremendo = !!sacudida && (sacudida.x !== 0 || sacudida.y !== 0);
  if (tremendo) {
    c.save();
    c.translate(centro + sacudida.x, linhaDeBatida + sacudida.y);
    c.rotate(sacudida.angulo);
    c.translate(-centro, -linhaDeBatida);
  }
  const metade = layout.largura / 2;
  const perto = projetar(layout, ATRAS_DA_LINHA);
  const longe = projetar(layout, 1);

  // Fundo da pista: o gradiente só é recriado quando o tamanho ou o star power mudam.
  const chave = `${largura}x${altura}:${cena.estrelaAtiva}`;
  if (gradienteDaPista?.chave !== chave) {
    const gradiente = c.createLinearGradient(0, longe.y, 0, perto.y);
    gradiente.addColorStop(0, comAlfa(cena.estrelaAtiva ? TRILHO_DA_ESTRELA[0] : cores.fundo, 0));
    gradiente.addColorStop(0.25, cena.estrelaAtiva ? comAlfa(TRILHO_DA_ESTRELA[1], 0.9) : comAlfa(cores.superficie, 0.95));
    gradiente.addColorStop(1, comAlfa(cena.estrelaAtiva ? TRILHO_DA_ESTRELA[2] : cores.fundo, 0.98));
    gradienteDaPista = { chave, valor: gradiente };
  }
  c.fillStyle = gradienteDaPista.valor;
  c.beginPath();
  c.moveTo(centro - metade * longe.escala, longe.y);
  c.lineTo(centro + metade * longe.escala, longe.y);
  c.lineTo(centro + metade * perto.escala, perto.y);
  c.lineTo(centro - metade * perto.escala, perto.y);
  c.closePath();
  c.fill();

  // Trilhos na cor do multiplicador. O brilho é uma linha larga e translúcida, mais leve que shadowBlur.
  const corDoTrilho = cena.estrelaAtiva ? COR_DA_ESTRELA : CORES_DO_MULTIPLICADOR[Math.min(3, cena.multiplicador - 1)];
  const trilhos = (espessura: number, opacidade: number) => {
    c.globalAlpha = opacidade;
    c.lineWidth = espessura;
    c.beginPath();
    for (const lado of [-1, 1]) {
      c.moveTo(centro + lado * metade * longe.escala, longe.y);
      c.lineTo(centro + lado * metade * perto.escala, perto.y);
    }
    c.stroke();
  };
  c.strokeStyle = corDoTrilho;
  if (efeitos) {
    trilhos(14, 0.12);
    trilhos(7, 0.25);
  }
  trilhos(3, 1);
  c.globalAlpha = 1;

  c.strokeStyle = comAlfa(cores.texto, 0.07);
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 1; i < 5; i++) {
    c.moveTo(centro + (i - 2.5) * larguraDoTraste * longe.escala, longe.y);
    c.lineTo(centro + (i - 2.5) * larguraDoTraste * perto.escala, perto.y);
  }
  c.stroke();

  for (let b = primeiroAPartirDe(cena.batidas, tempo + antecedencia * ATRAS_DA_LINHA); b < cena.batidas.length; b++) {
    const batida = cena.batidas[b];
    const distancia = (batida.tempo - tempo) / antecedencia;
    if (distancia > 1) break;
    const p = projetar(layout, distancia);
    c.strokeStyle = batida.forte ? comAlfa(cores.texto, 0.28) : comAlfa(cores.texto, 0.1);
    c.lineWidth = batida.forte ? 2 * p.escala + 1 : 1;
    c.beginPath();
    c.moveTo(centro - metade * p.escala, p.y);
    c.lineTo(centro + metade * p.escala, p.y);
    c.stroke();
  }

  // Botões da linha de batida
  for (let pista = 0; pista < 5; pista++) {
    const x = xDaPista(layout, pista, 1);
    const raio = larguraDoTraste * 0.34;
    const cor = CORES_DAS_PISTAS[pista];
    const apertado = cena.apertados[pista];
    if (apertado && efeitos) {
      const tamanho = larguraDoTraste * 1.3;
      c.globalAlpha = 0.55;
      c.drawImage(sprites.brilho(cor), x - tamanho / 2, linhaDeBatida - tamanho / 2, tamanho, tamanho);
      c.globalAlpha = 1;
    }
    c.beginPath();
    c.ellipse(x, linhaDeBatida, raio, raio * 0.55, 0, 0, Math.PI * 2);
    c.fillStyle = apertado ? cor : comAlfa(cores.fundo, 0.6);
    c.fill();
    c.lineWidth = 4;
    c.strokeStyle = cor;
    c.stroke();
    c.beginPath();
    c.ellipse(x, linhaDeBatida, raio * 0.45, raio * 0.25, 0, 0, Math.PI * 2);
    c.fillStyle = apertado ? comAlfa(cores.texto, 0.8) : comAlfa(cores.texto, 0.12);
    c.fill();
  }

  let ultima = cena.primeira;
  while (ultima < cena.notas.length && cena.notas[ultima].tempo - tempo < antecedencia) ultima++;

  // Rastros dos sustains, por baixo das notas
  for (let i = ultima - 1; i >= cena.primeira; i--) {
    const nota = cena.notas[i];
    if (nota.duracao <= 0 || (nota.acertada && !nota.segurando && !nota.solta)) continue;
    const inicio = Math.max(nota.segurando ? 0 : ATRAS_DA_LINHA, (nota.tempo - tempo) / antecedencia);
    const fim = Math.min(1, (nota.tempo + nota.duracao - tempo) / antecedencia);
    if (fim <= inicio) continue;
    const p0 = projetar(layout, inicio);
    const p1 = projetar(layout, fim);
    const x0 = xDaPista(layout, nota.pista, p0.escala);
    const x1 = xDaPista(layout, nota.pista, p1.escala);
    // O rastro vibra enquanto está sendo segurado, como no Guitar Hero.
    const vibracao = nota.segurando ? 1 + Math.sin(tempo * 40) * 0.25 : 1;
    const morto = nota.perdida || nota.solta;
    const faixa = (fator: number) => {
      const l0 = larguraDoTraste * 0.13 * p0.escala * vibracao * fator;
      const l1 = larguraDoTraste * 0.13 * p1.escala * vibracao * fator;
      c.beginPath();
      c.moveTo(x0 - l0, p0.y);
      c.lineTo(x0 + l0, p0.y);
      c.lineTo(x1 + l1, p1.y);
      c.lineTo(x1 - l1, p1.y);
      c.closePath();
      c.fill();
    };
    c.globalAlpha = morto ? 0.3 : 1;
    c.fillStyle = morto ? COR_DA_NOTA_PERDIDA : cena.estrelaAtiva ? COR_DA_ESTRELA : CORES_DAS_PISTAS[nota.pista];
    faixa(1);
    if (nota.segurando) {
      c.fillStyle = comAlfa(cores.texto, 0.55);
      faixa(0.35);
    }
  }
  c.globalAlpha = 1;

  // Notas, de trás para frente para a sobreposição ficar certa
  for (let i = ultima - 1; i >= cena.primeira; i--) {
    const nota = cena.notas[i];
    if (nota.acertada) continue;
    const distancia = (nota.tempo - tempo) / antecedencia;
    if (distancia < ATRAS_DA_LINHA) continue;
    const p = projetar(layout, distancia);
    const estrela = nota.frase >= 0 && !cena.frasesFalhas.has(nota.frase);
    const sprite = sprites.nota(cena.estrelaAtiva ? COR_DA_ESTRELA : CORES_DAS_PISTAS[nota.pista], estrela, efeitos);
    const escala = (larguraDoTraste * 0.36 * p.escala) / SPRITE_DA_NOTA.raio;
    const largura = SPRITE_DA_NOTA.largura * escala;
    const alturaDoSprite = SPRITE_DA_NOTA.altura * escala;
    c.globalAlpha = nota.perdida ? 0.35 : 1;
    c.drawImage(sprite, xDaPista(layout, nota.pista, p.escala) - largura / 2, p.y - alturaDoSprite / 2 + 6 * escala, largura, alturaDoSprite);
  }
  c.globalAlpha = 1;

  // Sem efeitos não há tremor, então não há transformação para desfazer.
  if (!efeitos) return;
  for (const explosao of cena.explosoes) {
    const idade = tempo - explosao.tempo;
    if (idade < 0 || idade > DURACAO_DA_EXPLOSAO) continue;
    const k = idade / DURACAO_DA_EXPLOSAO;
    const x = xDaPista(layout, explosao.pista, 1);
    const cor = cena.estrelaAtiva ? COR_DA_ESTRELA : CORES_DAS_PISTAS[explosao.pista];
    const tamanho = larguraDoTraste * 2 * (0.4 + k);
    c.globalAlpha = 1 - k;
    c.drawImage(sprites.brilho(cor), x - tamanho / 2, linhaDeBatida - tamanho / 2, tamanho, tamanho);
    c.strokeStyle = cor;
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(x, linhaDeBatida - k * 40, larguraDoTraste * 0.3 * (1 + k), larguraDoTraste * 0.15 * (1 + k), 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.globalAlpha = 1;

  for (const trovao of cena.trovoes) {
    const idade = tempo - trovao.tempo;
    if (idade < 0 || idade > DURACAO_DO_TROVAO) continue;
    desenharTrovao(c, largura, altura, layout, longe.y, trovao, idade / DURACAO_DO_TROVAO);
  }
  if (tremendo) c.restore();
}

/**
 * Clarão e raios caindo do horizonte até as laterais da linha de batida.
 * O raio pisca (some e volta) no começo, como um relâmpago de verdade.
 */
function desenharTrovao(
  c: CanvasRenderingContext2D,
  largura: number,
  altura: number,
  layout: ReturnType<typeof layoutDaPista>,
  horizonte: number,
  trovao: Cena["trovoes"][number],
  k: number,
) {
  const visivel = k < 0.16 || (k > 0.28 && k < 0.6);
  c.globalAlpha = (1 - k) * 0.12 * trovao.forca;
  c.fillStyle = cores.texto;
  c.fillRect(0, 0, largura, altura);
  if (!visivel) {
    c.globalAlpha = 1;
    return;
  }
  const raios = trovao.forca * 2;
  for (let i = 0; i < raios; i++) {
    const lado = i % 2 === 0 ? -1 : 1;
    const afastamento = 0.55 + (i >> 1) * 0.25;
    const inicio = { x: layout.centro + lado * layout.largura * 0.08 * (i >> 1), y: horizonte - 20 };
    const fim = { x: layout.centro + lado * layout.largura * afastamento, y: layout.linhaDeBatida };
    const pontos = pontosDoRaio(trovao.semente + i, inicio, fim, 9, layout.larguraDoTraste * 0.5);
    for (const [espessura, cor, opacidade] of [
      [18, cores.primaria, 0.4],
      [5, cores.texto, 1],
    ] as const) {
      c.globalAlpha = opacidade * (1 - k);
      c.strokeStyle = cor;
      c.lineWidth = espessura;
      c.beginPath();
      pontos.forEach((p, j) => (j ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.stroke();
    }
  }
  c.globalAlpha = 1;
}
