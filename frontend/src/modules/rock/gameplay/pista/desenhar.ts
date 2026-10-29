import { PISTA_ABERTA, type Batida, type TipoDaNota } from "@/modules/rock/songs";
import { cores } from "@/modules/rock/tema";
import { comAlfa } from "@/shared/styles/tokens";
import { CORES_DAS_PISTAS, CORES_DO_MULTIPLICADOR, COR_DA_ABERTA, COR_DA_ESTRELA, COR_DA_NOTA_PERDIDA, TRILHO_DA_ESTRELA, corDaPista } from "../cores";
import type { NotaEmJogo } from "../partida";
import { pontosDoRaio, tremor } from "./efeitos";
import { cordasDaPista, layoutDaPista, projetar, xDaPista, type LayoutDaPista } from "./geometria";

export interface Cena {
  notas: NotaEmJogo[];
  primeira: number;
  batidas: Batida[];
  apertados: boolean[];
  explosoes: { pista: number; tempo: number }[];
  /** Notas perdidas: o ERRO aparece em cima da tecla delas. */
  falhas: { pista: number; tempo: number }[];
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
  /** Sem tipo é a nota comum; HOPO e tap têm o visual do Clone Hero. */
  nota(cor: string, estrela: boolean, brilho: boolean, tipo?: TipoDaNota): CanvasImageSource;
  /** A nota aberta: uma barra deitada que atravessa os cinco trastes. */
  aberta(cor: string, estrela: boolean, brilho: boolean, tipo?: TipoDaNota): CanvasImageSource;
  brilho(cor: string): CanvasImageSource;
  /** Ruído e arranhões que deixam o braço com cara de gasto. */
  textura(): CanvasImageSource;
}

/** Tamanho do sprite de nota comparado com o raio da nota. */
export const SPRITE_DA_NOTA = { raio: 56, largura: 160, altura: 110 };
/** A barra da nota aberta: `barra` é a parte que cobre os cinco trastes. */
export const SPRITE_DA_ABERTA = { barra: 600, largura: 640, altura: 80 };
/** Quantos trastes de largura o rastro do sustain da aberta tem, comparado com o de uma nota. */
const LARGURA_DO_RASTRO_DA_ABERTA = 4;
const DURACAO_DA_EXPLOSAO = 0.3;
const DURACAO_DO_ERRO = 0.5;
const DURACAO_DO_TROVAO = 0.5;
const ATRAS_DA_LINHA = -0.12;
/** Parte final do braço (perto do horizonte) que vai sumindo. */
const TAMANHO_DO_FADE = 0.15;

/** Gradientes só mudam com o tamanho da tela ou o star power: criar um a cada quadro pesa no canvas. */
const gradientes = new Map<string, CanvasGradient>();
let contextoDosGradientes: CanvasRenderingContext2D | null = null;
const MAXIMO_DE_GRADIENTES = 32;

function gradienteGuardado(c: CanvasRenderingContext2D, chave: string, criar: () => CanvasGradient) {
  if (contextoDosGradientes !== c) {
    gradientes.clear();
    contextoDosGradientes = c;
  }
  let gradiente = gradientes.get(chave);
  if (!gradiente) {
    // Tamanhos antigos (a janela foi redimensionada) não voltam: limpa tudo de uma vez.
    if (gradientes.size >= MAXIMO_DE_GRADIENTES) gradientes.clear();
    gradiente = criar();
    gradientes.set(chave, gradiente);
  }
  return gradiente;
}

let padraoDoBraco: { textura: CanvasImageSource; contexto: CanvasRenderingContext2D; valor: CanvasPattern | null } | null = null;

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

  const tamanho = `${largura}x${altura}`;
  const comEstrela = `${tamanho}:${cena.estrelaAtiva}`;
  const fundoDaPista = gradienteGuardado(c, `pista:${comEstrela}`, () => {
    const gradiente = c.createLinearGradient(0, longe.y, 0, perto.y);
    gradiente.addColorStop(0, comAlfa(cena.estrelaAtiva ? TRILHO_DA_ESTRELA[0] : cores.fundo, 0));
    gradiente.addColorStop(0.25, cena.estrelaAtiva ? comAlfa(TRILHO_DA_ESTRELA[1], 0.9) : comAlfa(cores.superficie, 0.95));
    gradiente.addColorStop(1, comAlfa(cena.estrelaAtiva ? TRILHO_DA_ESTRELA[2] : cores.fundo, 0.98));
    return gradiente;
  });
  const contornoDoBraco = () => {
    c.beginPath();
    c.moveTo(centro - metade * longe.escala, longe.y);
    c.lineTo(centro + metade * longe.escala, longe.y);
    c.lineTo(centro + metade * perto.escala, perto.y);
    c.lineTo(centro - metade * perto.escala, perto.y);
    c.closePath();
  };
  c.fillStyle = fundoDaPista;
  contornoDoBraco();
  c.fill();

  // Textura gasta e a luz quente do palco batendo perto da linha de batida, só dentro do braço.
  const textura = sprites.textura();
  if (padraoDoBraco?.textura !== textura || padraoDoBraco.contexto !== c) {
    padraoDoBraco = { textura, contexto: c, valor: c.createPattern(textura, "repeat") };
  }
  c.save();
  contornoDoBraco();
  c.clip();
  if (padraoDoBraco.valor) {
    c.globalAlpha = 0.6;
    c.fillStyle = padraoDoBraco.valor;
    c.fillRect(centro - metade * perto.escala, longe.y, metade * perto.escala * 2, perto.y - longe.y);
    c.globalAlpha = 1;
  }
  c.fillStyle = gradienteGuardado(c, `luz:${comEstrela}`, () => {
    const luz = c.createRadialGradient(centro, linhaDeBatida, 0, centro, linhaDeBatida, layout.largura * 0.9);
    luz.addColorStop(0, comAlfa(cena.estrelaAtiva ? COR_DA_ESTRELA : cores.destaque, 0.16));
    luz.addColorStop(1, comAlfa(cores.destaque, 0));
    return luz;
  });
  c.fillRect(centro - metade * perto.escala, longe.y, metade * perto.escala * 2, perto.y - longe.y);
  c.restore();

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
  // Trilho de cromo com bisel; a cor do multiplicador fica num filete por cima.
  if (efeitos) {
    c.strokeStyle = corDoTrilho;
    trilhos(16, 0.1);
  }
  c.strokeStyle = cores.fundo;
  trilhos(10, 0.9);
  c.strokeStyle = cores.textoSuave;
  trilhos(6, 1);
  c.strokeStyle = corDoTrilho;
  trilhos(2.5, 1);
  c.globalAlpha = 1;

  // Trastes: cada batida é uma barra de metal, com a sombra embaixo e o brilho em cima.
  for (let b = primeiroAPartirDe(cena.batidas, tempo + antecedencia * ATRAS_DA_LINHA); b < cena.batidas.length; b++) {
    const batida = cena.batidas[b];
    const distancia = (batida.tempo - tempo) / antecedencia;
    if (distancia > 1) break;
    const p = projetar(layout, distancia);
    const grossura = (batida.forte ? 6 : 3) * p.escala + 1;
    if (batida.forte) {
      // Marcação de madrepérola no meio do braço, logo atrás do traste, como nas guitarras.
      const atras = projetar(layout, distancia + 0.035);
      c.beginPath();
      c.ellipse(centro, atras.y, larguraDoTraste * 0.16 * atras.escala, larguraDoTraste * 0.07 * atras.escala, 0, 0, Math.PI * 2);
      c.fillStyle = comAlfa(cores.texto, 0.18);
      c.fill();
    }
    for (const [cor, deslocamento, fator] of [
      [comAlfa(cores.fundo, 0.8), grossura * 0.6, 1],
      [comAlfa(cores.texto, batida.forte ? 0.55 : 0.25), 0, 0.6],
    ] as const) {
      c.strokeStyle = cor;
      c.lineWidth = grossura * fator;
      c.beginPath();
      c.moveTo(centro - metade * p.escala, p.y + deslocamento);
      c.lineTo(centro + metade * p.escala, p.y + deslocamento);
      c.stroke();
    }
  }

  desenharCordas(c, layout);

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
    // Aro prateado, anel na cor do traste e o miolo escuro, que acende ao apertar.
    // Vertical: o mesmo cromo serve para os cinco botões.
    const cromo = gradienteGuardado(c, `cromo:${tamanho}`, () => {
      const gradiente = c.createLinearGradient(0, linhaDeBatida - raio * 0.6, 0, linhaDeBatida + raio * 0.8);
      gradiente.addColorStop(0, cores.texto);
      gradiente.addColorStop(0.45, cores.textoSuave);
      gradiente.addColorStop(0.55, cores.borda);
      gradiente.addColorStop(1, cores.fundo);
      return gradiente;
    });
    c.beginPath();
    c.ellipse(x, linhaDeBatida + raio * 0.12, raio * 1.12, raio * 0.62, 0, 0, Math.PI * 2);
    c.fillStyle = cromo;
    c.fill();
    c.beginPath();
    c.ellipse(x, linhaDeBatida, raio, raio * 0.55, 0, 0, Math.PI * 2);
    c.fillStyle = cor;
    c.fill();
    c.beginPath();
    c.ellipse(x, linhaDeBatida, raio * 0.68, raio * 0.36, 0, 0, Math.PI * 2);
    c.fillStyle = apertado ? comAlfa(cores.texto, 0.85) : comAlfa(cores.fundo, 0.9);
    c.fill();
  }

  // A tecla da aberta acende a linha de batida inteira, de ponta a ponta.
  if (cena.apertados[PISTA_ABERTA] && efeitos) {
    const largura = larguraDoTraste * 5.4;
    const altura = larguraDoTraste * 0.9;
    c.globalAlpha = 0.6;
    c.drawImage(sprites.brilho(COR_DA_ABERTA), layout.centro - largura / 2, linhaDeBatida - altura / 2, largura, altura);
    c.globalAlpha = 1;
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
    // O rastro da aberta corre pelo meio do braço, mais largo.
    const aberta = nota.pista === PISTA_ABERTA;
    const pistaDoRastro = aberta ? 2 : nota.pista;
    const x0 = xDaPista(layout, pistaDoRastro, p0.escala);
    const x1 = xDaPista(layout, pistaDoRastro, p1.escala);
    // O rastro vibra enquanto está sendo segurado, como no Guitar Hero.
    const vibracao = nota.segurando ? 1 + Math.sin(tempo * 40) * 0.25 : 1;
    const morto = nota.perdida || nota.solta;
    const faixa = (fator: number) => {
      const largo = aberta ? LARGURA_DO_RASTRO_DA_ABERTA : 1;
      const l0 = larguraDoTraste * 0.13 * p0.escala * vibracao * fator * largo;
      const l1 = larguraDoTraste * 0.13 * p1.escala * vibracao * fator * largo;
      c.beginPath();
      c.moveTo(x0 - l0, p0.y);
      c.lineTo(x0 + l0, p0.y);
      c.lineTo(x1 + l1, p1.y);
      c.lineTo(x1 - l1, p1.y);
      c.closePath();
      c.fill();
    };
    c.globalAlpha = morto ? 0.3 : 1;
    c.fillStyle = morto ? COR_DA_NOTA_PERDIDA : cena.estrelaAtiva ? COR_DA_ESTRELA : corDaPista(nota.pista);
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
    const cor = cena.estrelaAtiva ? COR_DA_ESTRELA : corDaPista(nota.pista);
    c.globalAlpha = nota.perdida ? 0.35 : 1;
    if (nota.pista === PISTA_ABERTA) {
      const escala = (larguraDoTraste * 5 * p.escala) / SPRITE_DA_ABERTA.barra;
      const largura = SPRITE_DA_ABERTA.largura * escala;
      const alturaDoSprite = SPRITE_DA_ABERTA.altura * escala;
      c.drawImage(sprites.aberta(cor, estrela, efeitos, nota.tipo), layout.centro - largura / 2, p.y - alturaDoSprite / 2, largura, alturaDoSprite);
      continue;
    }
    const sprite = sprites.nota(cor, estrela, efeitos, nota.tipo);
    const escala = (larguraDoTraste * 0.36 * p.escala) / SPRITE_DA_NOTA.raio;
    const largura = SPRITE_DA_NOTA.largura * escala;
    const alturaDoSprite = SPRITE_DA_NOTA.altura * escala;
    c.drawImage(sprite, xDaPista(layout, nota.pista, p.escala) - largura / 2, p.y - alturaDoSprite / 2 + 6 * escala, largura, alturaDoSprite);
  }
  c.globalAlpha = 1;

  // Fade no fim do braço: apaga aos poucos tudo o que chega perto do horizonte, e o fundo da tela aparece.
  const fimDoFade = longe.y + (perto.y - longe.y) * TAMANHO_DO_FADE;
  c.globalCompositeOperation = "destination-out";
  c.fillStyle = gradienteGuardado(c, `fade:${tamanho}`, () => {
    const fade = c.createLinearGradient(0, longe.y, 0, fimDoFade);
    fade.addColorStop(0, comAlfa(cores.fundo, 1));
    fade.addColorStop(1, comAlfa(cores.fundo, 0));
    return fade;
  });
  c.fillRect(0, 0, largura, fimDoFade);
  c.globalCompositeOperation = "source-over";

  // O ERRO é aviso de jogo, não enfeite: aparece mesmo sem efeitos.
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = cores.perigo;
  for (const falha of cena.falhas) {
    const idade = tempo - falha.tempo;
    if (idade < 0 || idade > DURACAO_DO_ERRO) continue;
    const k = idade / DURACAO_DO_ERRO;
    const x = falha.pista === PISTA_ABERTA ? layout.centro : xDaPista(layout, falha.pista, 1);
    c.globalAlpha = 1 - k * k;
    c.font = `800 ${Math.round(larguraDoTraste * 0.32)}px sans-serif`;
    c.fillText("ERRO", x, linhaDeBatida - larguraDoTraste * 0.2 - k * 30);
  }
  c.globalAlpha = 1;

  // Sem efeitos não há tremor, então não há transformação para desfazer.
  if (!efeitos) return;
  for (const explosao of cena.explosoes) {
    const idade = tempo - explosao.tempo;
    if (idade < 0 || idade > DURACAO_DA_EXPLOSAO) continue;
    const k = idade / DURACAO_DA_EXPLOSAO;
    // A explosão da aberta sai do meio do braço e é bem maior, porque a nota cobre os cinco trastes.
    const aberta = explosao.pista === PISTA_ABERTA;
    const x = aberta ? layout.centro : xDaPista(layout, explosao.pista, 1);
    const cor = cena.estrelaAtiva ? COR_DA_ESTRELA : corDaPista(explosao.pista);
    const tamanho = larguraDoTraste * (aberta ? 5 : 2) * (0.4 + k);
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

/** Camadas de cada corda, de fora para dentro: largura relativa, deslocamento lateral e cor. */
const CAMADAS_DA_CORDA = [
  { largura: 1.3, desvio: 0.15, cor: comAlfa(cores.fundo, 0.7) },
  { largura: 1, desvio: 0, cor: comAlfa(cores.borda, 1) },
  { largura: 0.72, desvio: -0.05, cor: comAlfa(cores.textoSuave, 0.6) },
  { largura: 0.28, desvio: -0.2, cor: comAlfa(cores.textoSuave, 0.85) },
];
/** Voltas do fio enrolado ao longo do braço; a perspectiva aperta as do fundo. */
const VOLTAS_DO_ENROLAMENTO = 160;

/**
 * Cordas de metal: borda escura, corpo prateado e um brilho de um lado, que dão volume de cilindro.
 * O fio enrolado aparece como riscos diagonais, todos num stroke só.
 */
function desenharCordas(c: CanvasRenderingContext2D, layout: LayoutDaPista) {
  const cordas = cordasDaPista(layout, ATRAS_DA_LINHA);
  for (const corda of cordas) {
    for (const camada of CAMADAS_DA_CORDA) {
      const meia = (corda.espessura * camada.largura) / 2;
      const meiaNoFim = meia * corda.escalaDoFim;
      const desvio = corda.espessura * camada.desvio;
      c.fillStyle = camada.cor;
      c.beginPath();
      c.moveTo(corda.perto.x + desvio - meia, corda.perto.y);
      c.lineTo(corda.perto.x + desvio + meia, corda.perto.y);
      c.lineTo(corda.longe.x + desvio * corda.escalaDoFim + meiaNoFim, corda.longe.y);
      c.lineTo(corda.longe.x + desvio * corda.escalaDoFim - meiaNoFim, corda.longe.y);
      c.closePath();
      c.fill();
    }
  }

  c.strokeStyle = comAlfa(cores.fundo, 0.85);
  c.lineWidth = 1.5;
  c.beginPath();
  for (const corda of cordas) {
    if (!corda.enrolada) continue;
    for (let volta = 0; volta < VOLTAS_DO_ENROLAMENTO; volta++) {
      const p = projetar(layout, ATRAS_DA_LINHA + ((1 - ATRAS_DA_LINHA) * volta) / VOLTAS_DO_ENROLAMENTO);
      const x = xDaPista(layout, corda.pista, p.escala);
      const meia = (corda.espessura * p.escala) / 2;
      c.moveTo(x - meia, p.y + meia * 0.6);
      c.lineTo(x + meia, p.y - meia * 0.6);
    }
  }
  c.stroke();
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
