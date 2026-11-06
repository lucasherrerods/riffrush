import { PISTA_ABERTA, type Batida, type TipoDaNota } from "@/modules/rock/songs";
import { cores } from "@/modules/rock/tema";
import { comAlfa } from "@/shared/styles/tokens";
import { CORES_DAS_PISTAS, CORES_DO_MULTIPLICADOR, COR_DA_ABERTA, COR_DA_ESTRELA, COR_DA_NOTA_PERDIDA, TRILHO_DA_ESTRELA } from "../cores";
import { descidaDaPista, teclaDaAbertura } from "../abertura";
import type { NotaEmJogo } from "../partida";
import { DURACAO_DA_CHAMA, DURACAO_DO_ARO, elevacaoDoAro, forcaDaChama, linguasDeFogo, pontosDoRaio, pulo, tremor } from "./efeitos";
import { tracarForma } from "./formas";
import { faixasDaHighway } from "./highway";
import type { FormatoDaCacapa } from "@/modules/rock/skins";
import { cordasDaPista, layoutDaPista, projetar, xDaPista, type LayoutDaPista } from "./geometria";

const LADOS = [-1, 1] as const;

/** As chaves do cache de gradientes mudam só com o tamanho e o star power: não montam texto novo todo quadro. */
let ultimasChaves = { largura: -1, altura: -1, estrela: false, tamanho: "", comEstrela: "" };
function chavesDoTamanho(largura: number, altura: number, estrela: boolean) {
  const u = ultimasChaves;
  if (u.largura !== largura || u.altura !== altura || u.estrela !== estrela) {
    const tamanho = `${largura}x${altura}`;
    ultimasChaves = { largura, altura, estrela, tamanho, comEstrela: `${tamanho}:${estrela}` };
  }
  return ultimasChaves;
}

let tamanhoDaFonteDoErro = -1;
let fonteDoErroGuardada = "";
function fonteDoErro(tamanho: number) {
  if (tamanho !== tamanhoDaFonteDoErro) {
    tamanhoDaFonteDoErro = tamanho;
    fonteDoErroGuardada = `800 ${tamanho}px sans-serif`;
  }
  return fonteDoErroGuardada;
}

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
  /** Segundos desde o começo da contagem, enquanto a abertura da partida roda. */
  abertura?: number | null;
  /** O visual escolhido pelo jogador. Sem ela, as cores do tema. */
  skin?: SkinNaPista;
}

/** A parte da skin que a pista desenha: cores das notas e caçapas, o tom do braço e a imagem da highway já carregada. */
export interface SkinNaPista {
  trastes: string[];
  aberta: string;
  braco: string;
  /** Formato das caçapas e das notas. */
  formato?: FormatoDaCacapa;
  /** Força do brilho das notas e das caçapas acesas, de 0 a 1. */
  brilho?: number;
  contornoForte?: boolean;
  highway?: CanvasImageSource & { height: number; width: number };
}

const SKIN_DO_TEMA: SkinNaPista = { trastes: CORES_DAS_PISTAS, aberta: COR_DA_ABERTA, braco: cores.superficie };
/** Faixas em que a imagem da highway é cortada para parecer em perspectiva. */
const FAIXAS_DA_HIGHWAY = 120;

/** Imagens pré-desenhadas das notas e dos brilhos (ver sprites.ts). */
export interface Sprites {
  /** Sem tipo é a nota comum; HOPO e tap têm o visual do Clone Hero. */
  /** O formato segue o das caçapas; sem ele, redonda. */
  nota(cor: string, estrela: boolean, brilho: boolean, tipo?: TipoDaNota, formato?: FormatoDaCacapa, intensidade?: number, contornoForte?: boolean): CanvasImageSource;
  /** A nota aberta: uma barra deitada que atravessa os cinco trastes. */
  aberta(cor: string, estrela: boolean, brilho: boolean, tipo?: TipoDaNota): CanvasImageSource;
  brilho(cor: string): CanvasImageSource;
  /** Ruído e arranhões que deixam o braço com cara de gasto. */
  textura(): CanvasImageSource;
  /**
   * Uma parte que quase não muda (o braço, as cordas), desenhada uma vez num canvas fora da tela, em pixels do aparelho.
   * Só é redesenhada quando a `versao` ou o tamanho mudam. Sem ela, tudo é desenhado direto no quadro.
   */
  camada?(nome: string, versao: number, largura: number, altura: number, escala: number, desenhar: (c: CanvasRenderingContext2D) => void): CanvasImageSource;
}

/** Tamanho do sprite de nota comparado com o raio da nota. */
export const SPRITE_DA_NOTA = { raio: 56, largura: 160, altura: 110 };
/** A barra da nota aberta: `barra` é a parte que cobre os cinco trastes. */
export const SPRITE_DA_ABERTA = { barra: 600, largura: 640, altura: 80 };
/** Quantos trastes de largura o rastro do sustain da aberta tem, comparado com o de uma nota. */
const LARGURA_DO_RASTRO_DA_ABERTA = 4;
const DURACAO_DA_EXPLOSAO = 0.3;
const FORCA_DA_CHAMA_DO_SUSTAIN = 0.75;
/** Tamanho da chama em larguras de traste. */
const CHAMA = { altura: 1.25, largura: 0.28 };
/** Quanto o aro do traste levanta da base, em larguras de traste. */
const ALTURA_DO_ARO = 0.33;
/** O miolo do traste, onde o fogo acende, em larguras de traste. */
const MIOLO = { largura: 0.23, altura: 0.12 };
const DURACAO_DO_ERRO = 0.5;
const DURACAO_DO_TROVAO = 0.5;
const ATRAS_DA_LINHA = -0.12;
/** Parte final do braço (perto do horizonte) que vai sumindo. */
const TAMANHO_DO_FADE = 0.15;

/** Gradientes só mudam com o tamanho da tela ou o star power: criar um a cada quadro pesa no canvas. */
/** Um cache por contexto: na tela dividida as pistas se alternam a cada quadro e não podem apagar o cache uma da outra. */
const gradientesPorContexto = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasGradient>>();
const MAXIMO_DE_GRADIENTES = 32;

function gradienteGuardado(c: CanvasRenderingContext2D, chave: string, criar: () => CanvasGradient) {
  let gradientes = gradientesPorContexto.get(c);
  if (!gradientes) gradientesPorContexto.set(c, (gradientes = new Map()));
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
  /** Na tela dividida com muitas pistas: só o raio e o pulo, sem brilhos nem explosões. */
  soLeves = false,
) {
  // O raio e o pulo são poucos traços; o brilho dos trastes e as explosões é que pesam.
  const enfeites = efeitos && !soLeves;
  c.clearRect(0, 0, largura, altura);
  const layout = layoutDaPista(largura, altura);
  const { centro, linhaDeBatida, larguraDoTraste } = layout;
  const skin = cena.skin ?? SKIN_DO_TEMA;
  const formato = skin.formato ?? "redonda";
  const intensidade = skin.brilho ?? 1;
  const corDe = (pista: number) => (pista === PISTA_ABERTA ? skin.aberta : skin.trastes[pista]);

  // Na abertura, a pista inteira sobe de baixo da tela.
  const abertura = efeitos ? (cena.abertura ?? null) : null;
  if (abertura !== null) {
    c.save();
    c.translate(0, altura * descidaDaPista(abertura));
  }
  // O tremor e o pulo do star power giram e deslocam a pista em torno da linha de batida, na mesma transformação.
  const desde = efeitos && cena.estrelaDesde !== null ? tempo - cena.estrelaDesde : null;
  const sacudida = desde !== null ? tremor(desde) : null;
  const subida = desde !== null ? pulo(desde) : 0;
  const tremendo = !!sacudida && (sacudida.x !== 0 || sacudida.y !== 0 || subida !== 0);
  if (tremendo) {
    c.save();
    c.translate(centro + sacudida.x, linhaDeBatida + sacudida.y + subida);
    c.rotate(sacudida.angulo);
    c.translate(-centro, -linhaDeBatida);
  }
  const metade = layout.largura / 2;
  const perto = projetar(layout, ATRAS_DA_LINHA);
  const longe = projetar(layout, 1);

  const { tamanho, comEstrela } = chavesDoTamanho(largura, altura, cena.estrelaAtiva);
  const desenharTrilhos = (c: CanvasRenderingContext2D) => {
    // Trilhos na cor do multiplicador. O brilho é uma linha larga e translúcida, mais leve que shadowBlur.
    const corDoTrilho = cena.estrelaAtiva ? COR_DA_ESTRELA : CORES_DO_MULTIPLICADOR[Math.min(3, cena.multiplicador - 1)];
    const trilhos = (espessura: number, opacidade: number) => {
      c.globalAlpha = opacidade;
      c.lineWidth = espessura;
      c.beginPath();
      for (const lado of LADOS) {
        c.moveTo(centro + lado * metade * longe.escala, longe.y);
        c.lineTo(centro + lado * metade * perto.escala, perto.y);
      }
      c.stroke();
    };
    // Trilho de cromo com bisel; a cor do multiplicador fica num filete por cima.
    if (enfeites) {
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
  };
  // O braço (fundo, textura, luz e trilhos) só muda com o tamanho, o star power e o multiplicador.
  const desenharBraco = (c: CanvasRenderingContext2D) => {
    const fundoDaPista = gradienteGuardado(c, `pista:${comEstrela}:${skin.braco}`, () => {
      const gradiente = c.createLinearGradient(0, longe.y, 0, perto.y);
      gradiente.addColorStop(0, comAlfa(cena.estrelaAtiva ? TRILHO_DA_ESTRELA[0] : cores.fundo, 0));
      gradiente.addColorStop(0.25, cena.estrelaAtiva ? comAlfa(TRILHO_DA_ESTRELA[1], 0.9) : comAlfa(skin.braco, 0.95));
      gradiente.addColorStop(1, comAlfa(cena.estrelaAtiva ? TRILHO_DA_ESTRELA[2] : cores.fundo, 0.98));
      return gradiente;
    });
    const contornoDoBraco = () => tracarContornoDoBraco(c, layout);
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

    // Com highway, os trilhos vêm depois dela, por cima da imagem.
    if (!skin.highway) desenharTrilhos(c);

  };
  const corDoMultiplicador = Math.min(3, cena.multiplicador - 1);
  const versaoDoBraco = (cena.estrelaAtiva ? 1 : 0) | (corDoMultiplicador << 1) | (enfeites ? 8 : 0);
  const escala = c.getTransform?.()?.a ?? 1;
  if (sprites.camada) c.drawImage(sprites.camada("braco", versaoDoBraco, largura, altura, escala, desenharBraco), 0, 0, largura, altura);
  else desenharBraco(c);
  if (skin.highway) {
    desenharHighway(c, layout, skin.highway, tempo, antecedencia);
    desenharTrilhos(c);
  }

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
    // A sombra embaixo e o brilho em cima, sem criar uma lista por traste.
    const traste = (cor: string, deslocamento: number, fator: number) => {
      c.strokeStyle = cor;
      c.lineWidth = grossura * fator;
      c.beginPath();
      c.moveTo(centro - metade * p.escala, p.y + deslocamento);
      c.lineTo(centro + metade * p.escala, p.y + deslocamento);
      c.stroke();
    };
    traste(comAlfa(cores.fundo, 0.8), grossura * 0.6, 1);
    traste(comAlfa(cores.texto, batida.forte ? 0.55 : 0.25), 0, 0.6);
  }

  if (sprites.camada) c.drawImage(sprites.camada("cordas", 0, largura, altura, escala, (camada) => desenharCordas(camada, layout)), 0, 0, largura, altura);
  else desenharCordas(c, layout);

  // No acerto quem anima é o aro que salta; a base só acende no aperto em vazio.
  const saltando = enfeites ? trastesSaltando(cena, tempo) : null;
  // Botões da linha de batida
  for (let pista = 0; pista < 5; pista++) {
    const x = xDaPista(layout, pista, 1);
    const raio = larguraDoTraste * 0.34;
    const cor = skin.trastes[pista];
    const apertado = cena.apertados[pista] && !saltando?.[pista];
    if (apertado && enfeites && intensidade > 0) {
      const tamanho = larguraDoTraste * 1.3;
      c.globalAlpha = 0.55 * intensidade;
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
    desenharAro(c, x, linhaDeBatida, raio, cromo, cor, apertado ? comAlfa(cores.texto, 0.85) : comAlfa(cores.fundo, 0.9), formato);
  }

  // A tecla da aberta acende a linha de batida inteira, de ponta a ponta.
  if (cena.apertados[PISTA_ABERTA] && enfeites && !saltando?.[PISTA_ABERTA]) {
    const largura = larguraDoTraste * 5.4;
    const altura = larguraDoTraste * 0.9;
    c.globalAlpha = 0.6;
    c.drawImage(sprites.brilho(skin.aberta), layout.centro - largura / 2, linhaDeBatida - altura / 2, largura, altura);
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
    c.fillStyle = morto ? COR_DA_NOTA_PERDIDA : cena.estrelaAtiva ? COR_DA_ESTRELA : corDe(nota.pista);
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
    const cor = cena.estrelaAtiva ? COR_DA_ESTRELA : corDe(nota.pista);
    c.globalAlpha = nota.perdida ? 0.35 : 1;
    if (nota.pista === PISTA_ABERTA) {
      const escala = (larguraDoTraste * 5 * p.escala) / SPRITE_DA_ABERTA.barra;
      const largura = SPRITE_DA_ABERTA.largura * escala;
      const alturaDoSprite = SPRITE_DA_ABERTA.altura * escala;
      c.drawImage(sprites.aberta(cor, estrela, enfeites, nota.tipo), layout.centro - largura / 2, p.y - alturaDoSprite / 2, largura, alturaDoSprite);
      continue;
    }
    const sprite = sprites.nota(cor, estrela, enfeites && intensidade > 0, nota.tipo, formato, intensidade, skin.contornoForte);
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
    c.font = fonteDoErro(Math.round(larguraDoTraste * 0.32));
    c.fillText("ERRO", x, linhaDeBatida - larguraDoTraste * 0.2 - k * 30);
  }
  c.globalAlpha = 1;

  // Sem efeitos não há tremor, então não há transformação para desfazer.
  if (!efeitos) return;
  // No acerto, o aro do traste levanta da base e o fogo sai de dentro dele.
  for (const explosao of soLeves ? [] : cena.explosoes) {
    const idade = tempo - explosao.tempo;
    if (idade < 0 || idade > Math.max(DURACAO_DO_ARO, DURACAO_DA_CHAMA, DURACAO_DA_EXPLOSAO)) continue;
    desenharAroLevantado(c, layout, explosao.pista, cena.estrelaAtiva, elevacaoDoAro(idade), Math.round(explosao.tempo * 1000), tempo, forcaDaChama(idade), corDe, formato);
    if (idade > DURACAO_DA_EXPLOSAO) continue;
    const k = idade / DURACAO_DA_EXPLOSAO;
    // A explosão da aberta sai do meio do braço e é bem maior, porque a nota cobre os cinco trastes.
    const aberta = explosao.pista === PISTA_ABERTA;
    const x = aberta ? layout.centro : xDaPista(layout, explosao.pista, 1);
    const cor = cena.estrelaAtiva ? COR_DA_ESTRELA : corDe(explosao.pista);
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

  // Enquanto o sustain está sendo segurado, o traste continua pegando fogo.
  if (!soLeves) {
    for (let i = cena.primeira; i < ultima; i++) {
      const nota = cena.notas[i];
      if (!nota.segurando) continue;
      desenharAroLevantado(c, layout, nota.pista, cena.estrelaAtiva, 1, nota.pista + 1, tempo, FORCA_DA_CHAMA_DO_SUSTAIN, corDe, formato);
    }
  }

  for (const trovao of cena.trovoes) {
    const idade = tempo - trovao.tempo;
    if (idade < 0 || idade > DURACAO_DO_TROVAO) continue;
    desenharTrovao(c, largura, altura, layout, longe.y, trovao, idade / DURACAO_DO_TROVAO);
  }
  if (abertura !== null && !soLeves) {
    for (let traste = 0; traste < 5; traste++) {
      const { elevacao, chama } = teclaDaAbertura(abertura, traste);
      if (elevacao > 0) desenharAroLevantado(c, layout, traste, cena.estrelaAtiva, elevacao, traste + 1, tempo, chama, corDe, formato);
    }
  }
  if (tremendo) c.restore();
  if (abertura !== null) c.restore();
}

/** Trastes (e a aberta, no índice dela) com o aro levantado agora: num acerto recente ou segurando um sustain. */
function trastesSaltando(cena: Cena, tempo: number) {
  const saltando = [false, false, false, false, false, false];
  const marcar = (pista: number) => {
    if (pista === PISTA_ABERTA) saltando.fill(true);
    else saltando[pista] = true;
  };
  for (const explosao of cena.explosoes) {
    const idade = tempo - explosao.tempo;
    if (idade >= 0 && idade <= DURACAO_DO_ARO) marcar(explosao.pista);
  }
  for (let i = cena.primeira; i < cena.notas.length && cena.notas[i].tempo <= tempo; i++) {
    if (cena.notas[i].segurando) marcar(cena.notas[i].pista);
  }
  return saltando;
}

/** Um aro de traste: borda de metal, anel na cor do traste e o miolo. */
function desenharAro(c: CanvasRenderingContext2D, x: number, y: number, raio: number, metal: string | CanvasGradient, cor: string, miolo: string, formato: FormatoDaCacapa = "redonda") {
  const elipse = (cy: number, largura: number, altura: number, preenchimento: string | CanvasGradient) => {
    tracarForma(c, formato, x, cy, raio * largura, raio * altura);
    c.fillStyle = preenchimento;
    c.fill();
  };
  elipse(y + raio * 0.12, 1.12, 0.62, metal);
  elipse(y, 1, 0.55, cor);
  elipse(y, 0.68, 0.36, miolo);
}

/** O aro sobe da base e o fogo sai de dentro dele; a nota aberta levanta os cinco trastes. */
function desenharAroLevantado(c: CanvasRenderingContext2D, layout: LayoutDaPista, pista: number, estrela: boolean, elevacao: number, semente: number, tempo: number, forca: number, corDe: (pista: number) => string, formato: FormatoDaCacapa) {
  const { larguraDoTraste, linhaDeBatida } = layout;
  const aberta = pista === PISTA_ABERTA;
  const raio = larguraDoTraste * 0.34;
  const y = linhaDeBatida - elevacao * larguraDoTraste * ALTURA_DO_ARO;
  for (let traste = aberta ? 0 : pista; traste <= (aberta ? 4 : pista); traste++) {
    const x = xDaPista(layout, traste, 1);
    const cor = estrela ? COR_DA_ESTRELA : aberta ? corDe(PISTA_ABERTA) : corDe(traste);
    if (elevacao > 0) {
      // A coluna escura entre a base e o aro mostra que ele saiu do lugar.
      c.fillStyle = cores.fundo;
      c.fillRect(x - raio * 0.68, y, raio * 1.36, linhaDeBatida - y);
      desenharAro(c, x, y, raio, cores.textoSuave, cor, cores.fundo, formato);
    }
    if (forca > 0) desenharChama(c, x, y, larguraDoTraste, cor, semente + traste * 31, tempo, forca);
  }
}

/** Línguas de fogo somando luz: de fora para dentro, a cor do traste, depois o miolo branco. */
function desenharChama(c: CanvasRenderingContext2D, x: number, y: number, traste: number, cor: string, semente: number, tempo: number, forca: number) {
  const linguas = linguasDeFogo(semente, tempo, forca);
  // O fogo nasce dentro do miolo do traste, e as línguas saem dele.
  const miolo = (fator: number) => {
    c.beginPath();
    c.ellipse(x, y, traste * MIOLO.largura * fator, traste * MIOLO.altura * fator, 0, 0, Math.PI * 2);
    c.fill();
  };
  const lingua = (fator: number) => {
    c.beginPath();
    for (const { desvio, altura, largura } of linguas) {
      const meia = traste * CHAMA.largura * largura * fator;
      const base = x + desvio * traste * MIOLO.largura * 0.6 * fator;
      const topo = y - traste * CHAMA.altura * altura * fator;
      c.moveTo(base - meia, y);
      c.quadraticCurveTo(base - meia * 0.9, (y + topo) / 2, base + desvio * meia * 0.6, topo);
      c.quadraticCurveTo(base + meia * 0.9, (y + topo) / 2, base + meia, y);
      // A base é arredondada, para a chama sair de dentro do traste.
      c.quadraticCurveTo(base, y + meia * 0.6, base - meia, y);
    }
    c.fill();
  };
  c.globalCompositeOperation = "lighter";
  c.globalAlpha = 0.85;
  c.fillStyle = cor;
  miolo(1);
  lingua(1);
  c.globalAlpha = 1;
  c.fillStyle = cores.texto;
  miolo(0.7);
  lingua(0.55);
  c.globalCompositeOperation = "source-over";
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
    const raio = (espessura: number, cor: string, opacidade: number) => {
      c.globalAlpha = opacidade * (1 - k);
      c.strokeStyle = cor;
      c.lineWidth = espessura;
      c.beginPath();
      for (let j = 0; j < pontos.length; j++) {
        if (j) c.lineTo(pontos[j].x, pontos[j].y);
        else c.moveTo(pontos[j].x, pontos[j].y);
      }
      c.stroke();
    };
    raio(18, cores.primaria, 0.4);
    raio(5, cores.texto, 1);
  }
  c.globalAlpha = 1;
}

/** A imagem da highway por cima do braço, em faixas, correndo com as notas. */
function desenharHighway(c: CanvasRenderingContext2D, layout: LayoutDaPista, imagem: CanvasImageSource & { height: number; width: number }, tempo: number, antecedencia: number) {
  if (!imagem.width || !imagem.height) return;
  // Recorta no contorno do braço: as faixas são retângulos e, sem isso, passam da borda inclinada.
  c.save();
  tracarContornoDoBraco(c, layout);
  c.clip();
  for (const faixa of faixasDaHighway(layout, tempo, antecedencia, imagem.height, ATRAS_DA_LINHA, FAIXAS_DA_HIGHWAY)) {
    if (faixa.alturaDaOrigem <= 0) continue;
    // Meio pixel a mais em cada faixa esconde as emendas.
    c.drawImage(imagem, 0, faixa.origem, imagem.width, faixa.alturaDaOrigem, faixa.x, faixa.y - 0.5, faixa.largura, faixa.altura + 1);
  }
  c.restore();
}

/** O trapézio do braço, da linha de batida (um pouco antes) até o horizonte. */
function tracarContornoDoBraco(c: CanvasRenderingContext2D, layout: LayoutDaPista) {
  const metade = layout.largura / 2;
  const perto = projetar(layout, ATRAS_DA_LINHA);
  const longe = projetar(layout, 1);
  c.beginPath();
  c.moveTo(layout.centro - metade * longe.escala, longe.y);
  c.lineTo(layout.centro + metade * longe.escala, longe.y);
  c.lineTo(layout.centro + metade * perto.escala, perto.y);
  c.lineTo(layout.centro - metade * perto.escala, perto.y);
  c.closePath();
}
