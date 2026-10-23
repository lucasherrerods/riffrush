// Gera um personagem .vrm (VRM 1.0) estilizado a partir de uma receita em JSON, sem Blender.
// Uso: node scripts/gerar-personagem.mjs personagens/roqueiro.json [mais receitas...]
// Cada receita vira public/modelos/personagens/<id>.vrm. Detalhes em docs/personagens.md.
//
// O modelo sai pronto para o jogo: esqueleto humanoide com dedos, em pose T e virado para +Z (padrão VRM 1.0),
// materiais com os nomes do VRoid (para as cores do criador de personagem funcionarem),
// MToon com contorno e as expressões happy, sad, angry, relaxed, surprised e blink.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

// ================================================================ receita

const PADRAO = {
  nome: "Sem nome",
  autor: "Riff Rush",
  altura: 1.6,
  proporcoes: { cabeca: 1, ombros: 1, quadril: 1, bracos: 1, pernas: 1, barriga: 1, maos: 1 },
  cabelo: "espetado",
  manga: "curta",
  jaqueta: false,
  calca: "reta",
  acessorios: [],
  cores: {
    pele: "#e8bf98",
    cabelo: "#1c1a19",
    olhos: "#3b2a1e",
    roupa: "#1f1d1b",
    camiseta: "#d8d2c4",
    calca: "#2d3a4f",
    calcados: "#8a1c1c",
    detalhe: "#c8322b",
  },
};

export const CABELOS = ["espetado", "moicano", "franja", "longo", "rabo", "black", "careca"];
export const MANGAS = ["regata", "curta", "longa"];
export const CALCAS = ["reta", "bermuda"];
export const ACESSORIOS = ["oculos", "bandana", "bone", "corrente", "munhequeira", "brinco", "barba"];

function lerReceita(caminho) {
  const dado = JSON.parse(readFileSync(caminho, "utf8"));
  const r = {
    ...PADRAO,
    ...dado,
    id: dado.id ?? basename(caminho, ".json"),
    proporcoes: { ...PADRAO.proporcoes, ...dado.proporcoes },
    cores: { ...PADRAO.cores, ...dado.cores },
  };
  const conferir = (valor, opcoes, campo) => {
    if (!opcoes.includes(valor)) throw new Error(`${caminho}: "${campo}" deve ser um de ${opcoes.join(", ")} (veio "${valor}")`);
  };
  conferir(r.cabelo, CABELOS, "cabelo");
  conferir(r.manga, MANGAS, "manga");
  conferir(r.calca, CALCAS, "calca");
  for (const a of r.acessorios) conferir(a, ACESSORIOS, "acessorios");
  if (typeof r.jaqueta !== "boolean") throw new Error(`${caminho}: "jaqueta" deve ser true ou false`);
  for (const [parte, cor] of Object.entries(r.cores)) if (!/^#[0-9a-f]{6}$/i.test(cor)) throw new Error(`${caminho}: cor "${parte}" inválida (${cor})`);
  for (const [nome, valor] of Object.entries(r.proporcoes)) if (typeof valor !== "number" || valor < 0.7 || valor > 1.4) throw new Error(`${caminho}: proporção "${nome}" deve ficar entre 0.7 e 1.4`);
  return r;
}

// ================================================================ vetores

const soma = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const escala = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const ponto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const tamanho = (a) => Math.hypot(...a);
const normal = (a) => {
  const t = tamanho(a);
  return t < 1e-9 ? [0, 1, 0] : escala(a, 1 / t);
};
const misturar = (a, b, t) => soma(a, escala(sub(b, a), t));
const limitar = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const suave = (a, b, x) => {
  const t = limitar((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Ponto `a` empurrado `d` metros para longe de `b`. */
const alem = (a, b, d) => soma(a, escala(normal(sub(a, b)), d));
/** Curva de Bézier quadrática com n+1 pontos. */
const curva = (p0, p1, p2, n = 6) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return soma(soma(escala(p0, (1 - t) ** 2), escala(p1, 2 * (1 - t) * t)), escala(p2, t * t));
  });

// ================================================================ esqueleto

const DEDOS = [
  // nome, deslocamento lateral (para a frente, +Z), comprimentos das falanges, raio
  ["Index", 0.024, [0.03, 0.022, 0.02], 0.0098],
  ["Middle", 0.008, [0.033, 0.024, 0.021], 0.01],
  ["Ring", -0.008, [0.031, 0.022, 0.02], 0.0095],
  ["Little", -0.023, [0.024, 0.018, 0.016], 0.0085],
];
const FALANGES = ["Proximal", "Intermediate", "Distal"];
const POLEGAR = ["Metacarpal", "Proximal", "Distal"];

/** Posições dos ossos em pose T, em metros, para um corpo de 1,6 m. O personagem olha para +Z; a esquerda dele é +X. */
function montarEsqueleto(p) {
  const perna = 0.78 * p.pernas;
  const quadril = perna + 0.06;
  const y = (v) => quadril + v;
  const ombro = 0.165 * p.ombros;
  const ossos = [
    ["hips", null, [0, quadril, 0]],
    ["spine", "hips", [0, y(0.09), 0]],
    ["chest", "spine", [0, y(0.2), 0]],
    ["upperChest", "chest", [0, y(0.31), 0]],
    ["neck", "upperChest", [0, y(0.43), 0]],
    ["head", "neck", [0, y(0.51), 0]],
  ];
  const m = p.maos;
  for (const [lado, s] of [["left", 1], ["right", -1]]) {
    const L = (n) => lado + n;
    const altOmbro = y(0.405);
    const mao = [s * (ombro + 0.5 * p.bracos), altOmbro, 0];
    const dir = [s, 0, 0];
    ossos.push(
      [L("Shoulder"), "upperChest", [s * 0.035, altOmbro, 0]],
      [L("UpperArm"), L("Shoulder"), [s * ombro, altOmbro, 0]],
      [L("LowerArm"), L("UpperArm"), [s * (ombro + 0.255 * p.bracos), altOmbro, 0]],
      [L("Hand"), L("LowerArm"), mao],
      [L("UpperLeg"), "hips", [s * 0.09 * p.quadril, quadril - 0.06, 0]],
      [L("LowerLeg"), L("UpperLeg"), [s * 0.09 * p.quadril, quadril - 0.06 - perna * 0.47, 0]],
      [L("Foot"), L("LowerLeg"), [s * 0.09 * p.quadril, 0.085, 0]],
      [L("Toes"), L("Foot"), [s * 0.09 * p.quadril, 0.03, 0.115]],
    );
    // Dedos: as animações da Mixamo trazem a mão fechando no braço da guitarra.
    for (const [dedo, lateral, comprimentos] of DEDOS) {
      let pos = soma(mao, [s * 0.078 * m, -0.004, lateral * m]);
      let pai = L("Hand");
      FALANGES.forEach((falange, i) => {
        const nome = L(dedo + falange);
        ossos.push([nome, pai, pos]);
        pos = soma(pos, escala(dir, comprimentos[i] * m));
        pai = nome;
      });
    }
    const dirPolegar = normal([s * 0.55, -0.25, 0.8]);
    let pos = soma(mao, [s * 0.018 * m, -0.01, 0.022 * m]);
    let pai = L("Hand");
    [0.03, 0.028, 0.024].forEach((comprimento, i) => {
      const nome = L("Thumb" + POLEGAR[i]);
      ossos.push([nome, pai, pos]);
      pos = soma(pos, escala(dirPolegar, comprimento * m));
      pai = nome;
    });
  }
  return ossos.map(([nome, pai, pos]) => ({ nome, pai, pos }));
}

// ================================================================ geometria

/**
 * Sólido de revolução (torno) entre os pontos `de` e `ate`: o perfil é uma lista de [raio, t],
 * com t de 0 (em `de`) a 1 (em `ate`). `largura`/`fundo` achatam a seção em elipse.
 * Raio 0 numa ponta fecha o sólido. `arco` = [inicio, fim] em radianos deixa a superfície aberta (jaqueta).
 */
function torno({ de, ate, perfil, lados = 14, largura = 1, fundo = 1, giro = 0, arco }) {
  const eixo = sub(ate, de);
  const comprimento = tamanho(eixo);
  const Y = normal(eixo);
  let X;
  let Z;
  if (Math.abs(Y[1]) > 0.9) {
    X = [1, 0, 0];
    Z = normal(cruz(X, Y));
    if (Z[2] < 0) Z = escala(Z, -1);
    X = normal(cruz(Y, Z));
  } else {
    X = normal(cruz([0, 1, 0], Y));
    Z = cruz(X, Y);
  }
  const fechado = !arco;
  const colunas = fechado ? lados : lados + 1;
  const posicoes = [];
  const indices = [];
  const aneis = [];
  for (const [raio, t] of perfil) {
    const centro = soma(de, escala(Y, t * comprimento));
    if (raio < 1e-6) {
      aneis.push({ polo: posicoes.length });
      posicoes.push({ p: centro, t });
      continue;
    }
    const inicio = posicoes.length;
    for (let j = 0; j < colunas; j++) {
      const a = fechado ? giro + (j / lados) * Math.PI * 2 : arco[0] + (j / lados) * (arco[1] - arco[0]);
      posicoes.push({ p: soma(centro, soma(escala(X, Math.cos(a) * raio * largura), escala(Z, Math.sin(a) * raio * fundo))), t, a });
    }
    aneis.push({ inicio });
  }
  costurar(aneis, colunas, fechado, indices);
  return { posicoes, indices };
}

/** Liga anéis consecutivos em faixas de triângulos (e leques nos polos). */
function costurar(aneis, colunas, fechado, indices) {
  const passos = fechado ? colunas : colunas - 1;
  for (let i = 0; i < aneis.length - 1; i++) {
    const A = aneis[i];
    const B = aneis[i + 1];
    if (A.polo !== undefined && B.polo !== undefined) continue;
    for (let j = 0; j < passos; j++) {
      const k = (j + 1) % colunas;
      if (A.polo !== undefined) indices.push(A.polo, B.inicio + j, B.inicio + k);
      else if (B.polo !== undefined) indices.push(A.inicio + k, A.inicio + j, B.polo);
      else indices.push(A.inicio + j, B.inicio + k, A.inicio + k, A.inicio + j, B.inicio + j, B.inicio + k);
    }
  }
}

/**
 * Tubo que segue um caminho de pontos (mechas de cabelo, braços, pernas, dedos).
 * `raio(t)` dá a espessura ao longo do caminho; as pontas fecham arredondadas.
 */
function tubo(caminho, raio, { lados = 10, cima = [0, 1, 0], largura = 1, fundo = 1, tampas = true } = {}) {
  const n = caminho.length;
  const tangentes = caminho.map((_, i) => normal(sub(caminho[Math.min(n - 1, i + 1)], caminho[Math.max(0, i - 1)])));
  let N = sub(cima, escala(tangentes[0], ponto(cima, tangentes[0])));
  if (tamanho(N) < 1e-4) N = cruz(tangentes[0], [0, 0, 1]);
  N = normal(N);
  const posicoes = [];
  const indices = [];
  const aneis = [];
  const comprimentos = [0];
  for (let i = 1; i < n; i++) comprimentos.push(comprimentos[i - 1] + tamanho(sub(caminho[i], caminho[i - 1])));
  const total = comprimentos[n - 1] || 1;
  const polo = (p, t) => {
    aneis.push({ polo: posicoes.length });
    posicoes.push({ p, t });
  };
  if (tampas) polo(soma(caminho[0], escala(tangentes[0], -raio(0) * 0.55)), 0);
  for (let i = 0; i < n; i++) {
    const T = tangentes[i];
    // Transporte paralelo: o "cima" de cada anel acompanha a curva sem torcer.
    N = normal(sub(N, escala(T, ponto(N, T))));
    const K = cruz(N, T);
    const t = comprimentos[i] / total;
    const r = raio(t);
    const inicio = posicoes.length;
    for (let j = 0; j < lados; j++) {
      const a = (j / lados) * Math.PI * 2;
      posicoes.push({ p: soma(caminho[i], soma(escala(N, Math.cos(a) * r * largura), escala(K, Math.sin(a) * r * fundo))), t });
    }
    aneis.push({ inicio });
  }
  if (tampas) polo(soma(caminho[n - 1], escala(tangentes[n - 1], raio(1) * 0.55)), 1);
  costurar(aneis, lados, true, indices);
  return { posicoes, indices };
}

const perfilDeEsfera = (n = 8) => Array.from({ length: n + 1 }, (_, i) => [Math.sin((i / n) * Math.PI), i / n]);
function perfilDeCapsula(r0, r1, ponta = 0.18) {
  const p = [[0, 0]];
  for (const s of [0.35, 0.7, 1]) p.push([r0 * Math.sin((s * Math.PI) / 2), ponta * (1 - Math.cos((s * Math.PI) / 2))]);
  for (const s of [1, 0.7, 0.35]) p.push([r1 * Math.sin((s * Math.PI) / 2), 1 - ponta * (1 - Math.cos((s * Math.PI) / 2))]);
  p.push([0, 1]);
  return p;
}
function elipsoide(c, rx, ry, rz, lados = 14, aneis = 8) {
  return torno({ de: sub(c, [0, ry, 0]), ate: soma(c, [0, ry, 0]), perfil: perfilDeEsfera(aneis), lados, largura: rx, fundo: rz });
}
/** Caminho reto entre dois pontos, com n divisões (para tubos que dobram nas juntas). */
const reta = (a, b, n = 4) => Array.from({ length: n + 1 }, (_, i) => misturar(a, b, i / n));

// ================================================================ rosto

/**
 * Superfície da frente da cabeça: dado um ponto (x, y) relativo ao centro, devolve a profundidade z
 * da pele. Os olhos, a boca e as sobrancelhas são "adesivos" colados nela.
 */
function superficieDaCabeca(cabeca) {
  return (x, y) => {
    let z = -Infinity;
    for (const { c, rx, ry, rz } of cabeca) {
      const dx = (x - c[0]) / rx;
      const dy = (y - c[1]) / ry;
      const q = 1 - dx * dx - dy * dy;
      if (q > 0) z = Math.max(z, c[2] + rz * Math.sqrt(q));
    }
    return z;
  };
}

/**
 * Adesivo: forma plana (lista de pontos 2D com coordenadas normalizadas u, w) projetada na pele.
 * Cada vértice guarda (u, w) para as expressões moverem o adesivo pela pele sem afundar nela.
 */
function adesivo(sup, centro, forma, indices, desloc) {
  const projetar = ([x, y]) => [centro[0] + x, centro[1] + y, centro[2] + sup(x, y) + desloc];
  const posicoes = forma.map(({ xy, u, w }) => ({ p: projetar(xy), u, w, xy }));
  // Garante que os triângulos olham para fora (+Z).
  const corrigidos = [];
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [indices[i], indices[i + 1], indices[i + 2]].map((k) => forma[k].xy);
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    corrigidos.push(...(area >= 0 ? [indices[i], indices[i + 1], indices[i + 2]] : [indices[i], indices[i + 2], indices[i + 1]]));
  }
  return { posicoes, indices: corrigidos, projetar };
}

/** Disco elíptico em (cx, cy) com semieixos (rx, ry), em anéis. */
function formaDeDisco(cx, cy, rx, ry, lados = 16, aneis = 2) {
  const forma = [{ xy: [cx, cy], u: 0, w: 0 }];
  const indices = [];
  for (let k = 1; k <= aneis; k++) {
    const f = k / aneis;
    for (let j = 0; j < lados; j++) {
      const a = (j / lados) * Math.PI * 2;
      forma.push({ xy: [cx + Math.cos(a) * rx * f, cy + Math.sin(a) * ry * f], u: Math.cos(a) * f, w: Math.sin(a) * f });
    }
  }
  for (let j = 0; j < lados; j++) indices.push(0, 1 + j, 1 + ((j + 1) % lados));
  for (let k = 1; k < aneis; k++) {
    const A = 1 + (k - 1) * lados;
    const B = 1 + k * lados;
    for (let j = 0; j < lados; j++) {
      const n = (j + 1) % lados;
      indices.push(A + j, B + j, B + n, A + j, B + n, A + n);
    }
  }
  return { forma, indices };
}

/** Faixa curva (cílios, sobrancelha): pontos de cima e de baixo ao longo de u de -1 a 1. */
function formaDeFaixa(n, pontoEm) {
  const forma = [];
  const indices = [];
  for (let i = 0; i <= n; i++) {
    const u = -1 + (2 * i) / n;
    const [cima, baixo] = pontoEm(u);
    forma.push({ xy: cima, u, w: 1 }, { xy: baixo, u, w: -1 });
  }
  for (let i = 0; i < n; i++) indices.push(2 * i, 2 * i + 1, 2 * i + 3, 2 * i, 2 * i + 3, 2 * i + 2);
  return { forma, indices };
}

// ================================================================ montagem

class Malha {
  constructor(material) {
    this.material = material;
    this.posicoes = [];
    this.indices = [];
    this.pesos = [];
    this.alvos = {};
  }
  /** `pesos`: nome do osso, ou função do vértice que devolve [[osso, peso], ...]. `deformar`: expressão -> delta do vértice. */
  adicionar(geo, pesos, deformar = {}) {
    const base = this.posicoes.length;
    for (const v of geo.posicoes) {
      this.posicoes.push(v.p);
      this.pesos.push(typeof pesos === "function" ? pesos(v) : [[pesos, 1]]);
    }
    for (const [nome, f] of Object.entries(deformar)) {
      const lista = (this.alvos[nome] ??= []);
      while (lista.length < base) lista.push([0, 0, 0]);
      for (const v of geo.posicoes) lista.push(f(v));
    }
    for (const i of geo.indices) this.indices.push(base + i);
    return this;
  }
  normais() {
    const n = this.posicoes.map(() => [0, 0, 0]);
    for (let i = 0; i < this.indices.length; i += 3) {
      const [a, b, c] = [this.indices[i], this.indices[i + 1], this.indices[i + 2]];
      const f = cruz(sub(this.posicoes[b], this.posicoes[a]), sub(this.posicoes[c], this.posicoes[a]));
      for (const k of [a, b, c]) n[k] = soma(n[k], f);
    }
    return n.map(normal);
  }
  completarAlvos(nomes) {
    for (const nome of nomes) {
      const lista = (this.alvos[nome] ??= []);
      while (lista.length < this.posicoes.length) lista.push([0, 0, 0]);
    }
  }
}

/**
 * Pesos de um membro contínuo que passa por vários ossos (braço, perna, dedo).
 * `cortes` são os t onde cada osso começa; perto de cada junta o peso se divide entre os dois ossos,
 * para a dobra ficar redonda.
 */
const pesosDeCadeia = (ossos, cortes, faixa = 0.06) => (v) => {
  let i = 0;
  while (i < ossos.length - 1 && v.t >= cortes[i + 1]) i++;
  const p = [[ossos[i], 1]];
  if (i + 1 < ossos.length) {
    const w = 0.5 * suave(cortes[i + 1] - faixa, cortes[i + 1], v.t);
    if (w > 0) p.push([ossos[i + 1], w]);
  }
  if (i > 0) {
    const w = 0.5 * (1 - suave(cortes[i], cortes[i] + faixa, v.t));
    if (w > 0) p.push([ossos[i - 1], w]);
  }
  const total = p.reduce((s, [, w]) => s + w, 0);
  return p.map(([o, w]) => [o, w / total]);
};

/** Caminho que passa pelos pontos dados, com `n` divisões por trecho, e os t de cada ponto. */
function caminhoPor(pontos, n = 4) {
  const caminho = [pontos[0]];
  for (let i = 1; i < pontos.length; i++) caminho.push(...reta(pontos[i - 1], pontos[i], n).slice(1));
  const comp = [0];
  for (let i = 1; i < pontos.length; i++) comp.push(comp[i - 1] + tamanho(sub(pontos[i], pontos[i - 1])));
  return { caminho, cortes: comp.map((c) => c / comp.at(-1)) };
}

/** Pesos ao longo da coluna (quadril até pescoço), por altura. */
function pesosDoTronco(O) {
  const faixas = [["hips", O.hips[1]], ["spine", O.spine[1]], ["chest", O.chest[1]], ["upperChest", O.upperChest[1]], ["neck", O.neck[1]]];
  return (v) => {
    const y = v.p[1];
    let i = 0;
    while (i < faixas.length - 1 && y >= faixas[i + 1][1]) i++;
    const [osso, inicio] = faixas[i];
    const prox = faixas[i + 1];
    if (!prox) return [[osso, 1]];
    const w = suave(0.45, 1, (y - inicio) / (prox[1] - inicio)) * 0.5;
    return w > 0 ? [[osso, 1 - w], [prox[0], w]] : [[osso, 1]];
  };
}

function montarPersonagem(r) {
  const p = r.proporcoes;
  const esqueleto = montarEsqueleto(p);
  const O = Object.fromEntries(esqueleto.map((o) => [o.nome, o.pos]));
  const cab = p.cabeca;
  const temJaqueta = r.jaqueta;

  const M = {
    pele: new Malha("Body_00_SKIN"),
    roupa: new Malha("Tops_00_CLOTH"),
    camiseta: new Malha("Inner_00_SHIRT"),
    calca: new Malha("Bottoms_00_CLOTH"),
    tenis: new Malha("Shoes_00_CLOTH"),
    sola: new Malha("Shoes_00_SOLE"),
    cabelo: new Malha("Hair_00_HAIR"),
    sobrancelha: new Malha("Brow_00_HAIR"),
    branco: new Malha("EyeWhite_00_FACE"),
    iris: new Malha("EyeIris_00_EYE"),
    traco: new Malha("FaceLine_00_FACE"),
    boca: new Malha("FaceMouth_00_FACE"),
    dentes: new Malha("Teeth_00_FACE"),
    detalhe: new Malha("Accessory_00_ACCE"),
    couro: new Malha("Belt_00_ACCE"),
    metal: new Malha("Metal_00_ACCE"),
    lente: new Malha("Lens_00_ACCE"),
  };
  // Com jaqueta, a camiseta de baixo fica na cor "camiseta" e a jaqueta é a "roupa" colorível.
  const blusa = temJaqueta ? M.camiseta : M.roupa;

  // ---------------------------------------------------------- cabeça
  const R = 0.148 * cab;
  const C = soma(O.head, [0, R * 0.92, 0.012]);
  const cabeca = [
    { c: C, rx: R, ry: R * 1.04, rz: R * 0.98 },
    { c: soma(C, [0, -R * 0.42, R * 0.12]), rx: R * 0.8, ry: R * 0.62, rz: R * 0.8 }, // bochechas e queixo
  ];
  for (const e of cabeca) M.pele.adicionar(elipsoide(e.c, e.rx, e.ry, e.rz, 18, 12), "head");
  for (const s of [1, -1]) M.pele.adicionar(elipsoide(soma(C, [s * R * 0.96, -R * 0.12, -R * 0.02]), R * 0.14, R * 0.22, R * 0.12, 8, 6), "head");
  const sup = superficieDaCabeca(cabeca.map((e) => ({ ...e, c: sub(e.c, C) })));
  // Nariz: uma bolinha discreta.
  M.pele.adicionar(elipsoide(soma(C, [0, -R * 0.2, sup(0, -R * 0.2) - R * 0.04]), R * 0.09, R * 0.1, R * 0.09, 8, 6), "head");
  M.pele.adicionar(tubo(reta(soma(O.neck, [0, -0.05, -0.005]), soma(O.head, [0, 0.07, 0]), 3), () => 0.048, { lados: 12 }), (v) => (v.t > 0.6 ? [["neck", 0.5], ["head", 0.5]] : [["neck", 1]]));

  // ---------------------------------------------------------- olhos
  const ew = 0.19 * R;
  const eh = 0.24 * R;
  for (const s of [1, -1]) {
    const ex = s * R * 0.36;
    const ey = -R * 0.02;
    const interno = (x) => limitar((-s * (x - ex)) / ew, -1, 1); // 1 no canto de dentro (perto do nariz)
    // Posição de um ponto do olho em cada expressão (em xy do rosto, relativo ao centro da cabeça).
    const olho = {
      blink: ([x, y]) => [x, ey - eh * 0.3 + (y - ey) * 0.06],
      happy: ([x, y]) => {
        const k = (x - ex) / ew;
        return [x, ey - eh * 0.15 + (y - ey) * 0.14 + eh * 0.42 * (1 - k * k)];
      },
      relaxed: ([x, y]) => [x, y > ey ? ey + (y - ey) * 0.42 : y],
      angry: ([x, y]) => [x, y > ey ? ey + (y - ey) * 0.6 - interno(x) * (y - ey) * 0.45 : y],
      sad: ([x, y]) => [x, y > ey ? ey + (y - ey) * 0.75 + interno(x) * (y - ey) * 0.2 - (1 - interno(x)) * (y - ey) * 0.25 : y],
      surprised: ([x, y]) => [ex + (x - ex) * 1.1, ey + (y - ey) * 1.14],
    };
    const deformarAdesivo = (geo, mapa, extra = {}) =>
      Object.fromEntries(Object.entries({ ...mapa, ...extra }).map(([nome, f]) => [nome, (v) => sub(geo.projetar(f(v.xy)), v.p)]));
    const camada = (malha, forma, desloc, extra) => {
      const geo = adesivo(sup, C, forma.forma, forma.indices, desloc);
      malha.adicionar(geo, "head", deformarAdesivo(geo, olho, extra));
    };
    camada(M.branco, formaDeDisco(ex, ey, ew, eh, 20, 2), 0.002);
    const ix = ex + s * -0.06 * ew;
    camada(M.iris, formaDeDisco(ix, ey - eh * 0.08, ew * 0.66, eh * 0.7, 18, 2), 0.0032);
    const encolher = (k) => ([x, y]) => [ix + (x - ix) * k, ey - eh * 0.08 + (y - (ey - eh * 0.08)) * k];
    camada(M.traco, formaDeDisco(ix, ey - eh * 0.08, ew * 0.32, eh * 0.36, 14, 1), 0.0044, {
      surprised: ([x, y]) => olho.surprised(encolher(0.55)([x, y])),
    });
    // Brilho: some quando o olho fecha.
    camada(M.branco, formaDeDisco(ix + s * ew * 0.18 - ew * 0.05, ey + eh * 0.22, ew * 0.16, eh * 0.15, 10, 1), 0.0055);
    // Cílios: faixa grossa por cima do olho, com um "rabinho" no canto de fora.
    const cilios = formaDeFaixa(14, (u) => {
      const a = Math.PI / 2 - u * s * 1.15;
      const externo = limitar(-u * s);
      const raio = [ew * 1.08, eh * 1.06];
      const topo = [ex + Math.cos(a) * raio[0] * (1 + externo * 0.12), ey + Math.sin(a) * raio[1] + externo * eh * 0.08];
      const base = [ex + Math.cos(a) * ew * 0.94, ey + Math.sin(a) * eh * 0.86];
      return [topo, base];
    });
    camada(M.traco, cilios, 0.0048);

    // Sobrancelha: cor do cabelo.
    const by = ey + eh * 1.75;
    const sobrancelha = formaDeFaixa(10, (u) => {
      const x = ex + u * ew * 1.15;
      const arco = (1 - u * u) * eh * 0.18;
      const grossura = eh * (0.24 - 0.08 * limitar(-u * s));
      return [[x, by + arco + grossura / 2], [x, by + arco - grossura / 2]];
    });
    const geoSob = adesivo(sup, C, sobrancelha.forma, sobrancelha.indices, 0.0035);
    const moverSob = (f) => (v) => sub(geoSob.projetar(f(v.xy)), v.p);
    M.sobrancelha.adicionar(geoSob, "head", {
      angry: moverSob(([x, y]) => [x - s * ew * 0.05, y - eh * 0.28 - interno(x) * eh * 0.32]),
      sad: moverSob(([x, y]) => [x, y + interno(x) * eh * 0.32 - eh * 0.05]),
      happy: moverSob(([x, y]) => [x, y + eh * 0.15]),
      relaxed: moverSob(([x, y]) => [x, y - eh * 0.06]),
      surprised: moverSob(([x, y]) => [x, y + eh * 0.42]),
    });
  }

  // ---------------------------------------------------------- boca
  const mx = 0;
  const my = -R * 0.5;
  const mw = R * 0.24;
  const mh = R * 0.022;
  const raiz = (u) => Math.sqrt(Math.max(0, 1 - u * u));
  // Formas da boca em coordenadas normalizadas (u de -1 a 1 na largura, w de -1 a 1 na altura).
  const formaDaBoca = {
    neutra: (u, w) => [mx + mw * u, my + mh * w + mw * 0.04 * u * u],
    happy: (u, w) => [mx + mw * 1.08 * u, my + mw * 0.3 * u * u + (w < 0 ? w * mw * 0.62 * raiz(u) : w * mh)],
    surprised: (u, w) => [mx + mw * 0.48 * u, my - mw * 0.2 + mw * 0.62 * w],
    sad: (u, w) => [mx + mw * 0.9 * u, my + mw * 0.1 - mw * 0.3 * u * u + mh * w],
    angry: (u, w) => [mx + mw * 0.92 * u, my - mw * 0.14 * u * u + w * mw * 0.24],
    relaxed: (u, w) => [mx + mw * u, my - mw * 0.04 + mw * 0.2 * u * u + mh * w],
  };
  const disco = formaDeDisco(0, 0, 1, 1, 22, 3);
  const formaBoca = { forma: disco.forma.map((f) => ({ ...f, xy: formaDaBoca.neutra(f.u, f.w) })), indices: disco.indices };
  const geoBoca = adesivo(sup, C, formaBoca.forma, formaBoca.indices, 0.0025);
  const exprBoca = Object.fromEntries(
    ["happy", "surprised", "sad", "angry", "relaxed"].map((nome) => [nome, (v) => sub(geoBoca.projetar(formaDaBoca[nome](v.u, v.w)), v.p)]),
  );
  M.boca.adicionar(geoBoca, "head", exprBoca);
  // Dentes de cima: escondidos (achatados) na boca fechada, aparecem no sorriso e na careta.
  const formaDosDentes = {
    neutra: (u) => [mx + mw * 0.5 * u, my + mh * 0.5],
    happy: (u, w) => [mx + mw * 0.86 * u, my + mw * 0.3 * u * u - ((1 - w) / 2) * mw * 0.2 * raiz(u)],
    angry: (u, w) => [mx + mw * 0.8 * u, my - mw * 0.14 * u * u + w * mw * 0.16],
    surprised: (u, w) => [mx + mw * 0.36 * u, my + mw * 0.36 - ((1 - w) / 2) * mw * 0.1 * raiz(u)],
  };
  const formaD = { forma: disco.forma.map((f) => ({ ...f, xy: formaDosDentes.neutra(f.u, f.w) })), indices: disco.indices };
  const geoDentes = adesivo(sup, C, formaD.forma, formaD.indices, 0.0035);
  M.dentes.adicionar(
    geoDentes,
    "head",
    Object.fromEntries(["happy", "angry", "surprised"].map((nome) => [nome, (v) => sub(geoDentes.projetar(formaDosDentes[nome](v.u, v.w)), v.p)])),
  );

  // ---------------------------------------------------------- tronco
  const pesosTronco = pesosDoTronco(O);
  const altura = (y) => (y - (O.hips[1] - 0.06)) / (O.neck[1] + 0.02 - (O.hips[1] - 0.06));
  const perfilTronco = [
    [0, 0],
    [0.13 * p.quadril, 0.015],
    [0.15 * p.quadril, 0.12],
    [0.145 * p.barriga, 0.32],
    [0.15 * p.barriga, 0.48],
    [0.165 * p.ombros, 0.7],
    [0.165 * p.ombros, 0.84],
    [0.13 * p.ombros, 0.93],
    [0.06, 0.985],
    [0, 1],
  ];
  M[temJaqueta ? "camiseta" : "roupa"].adicionar(
    torno({ de: soma(O.hips, [0, -0.06, 0]), ate: soma(O.neck, [0, 0.02, 0]), perfil: perfilTronco, lados: 18, fundo: 0.66 }),
    pesosTronco,
  );
  // Gola da camiseta.
  blusa.adicionar(torno({ de: soma(O.neck, [0, -0.035, 0]), ate: soma(O.neck, [0, -0.012, 0]), perfil: [[0.062, 0], [0.066, 0.5], [0.06, 1]], lados: 14, fundo: 0.85 }), "upperChest");
  void altura;

  if (temJaqueta) {
    // Jaqueta aberta na frente, um pouco maior que o tronco, com gola levantada.
    const aberta = [Math.PI / 2 + 0.42, Math.PI / 2 + Math.PI * 2 - 0.42];
    M.roupa.adicionar(
      torno({
        de: soma(O.hips, [0, -0.02, 0]),
        ate: soma(O.neck, [0, 0.0, 0]),
        perfil: perfilTronco.slice(1, -2).map(([raio, t]) => [raio * 1.1 + 0.006, (t - 0.015) / 0.915]),
        lados: 20,
        fundo: 0.68,
        arco: aberta,
      }),
      pesosTronco,
    );
    M.roupa.adicionar(
      torno({ de: soma(O.neck, [0, -0.045, -0.005]), ate: soma(O.neck, [0, 0.04, -0.01]), perfil: [[0.08, 0], [0.085, 1]], lados: 16, fundo: 0.9, arco: [Math.PI / 2 + 0.7, Math.PI / 2 + Math.PI * 2 - 0.7] }),
      (v) => (v.t > 0.5 ? [["upperChest", 0.6], ["neck", 0.4]] : [["upperChest", 1]]),
    );
    // Zíper e bolsos: detalhes de metal.
    for (const s of [1, -1]) M.metal.adicionar(tubo(reta(soma(O.spine, [s * 0.055, -0.02, 0.105 * p.barriga]), soma(O.upperChest, [s * 0.06, 0.02, 0.118 * p.barriga]), 4), () => 0.004, { lados: 5 }), pesosTronco);
  }

  // Cinto com fivela.
  const yCinto = O.hips[1] + 0.035;
  M.couro.adicionar(torno({ de: [0, yCinto - 0.022, 0], ate: [0, yCinto + 0.022, 0], perfil: [[0.152 * p.quadril, 0], [0.155 * p.quadril, 0.5], [0.152 * p.quadril, 1]], lados: 18, fundo: 0.7 }), "hips");
  M.metal.adicionar(torno({ de: [0, yCinto, 0.1 * p.quadril], ate: [0, yCinto, 0.118 * p.quadril], perfil: [[0, 0], [0.026, 0.1], [0.026, 0.9], [0, 1]], lados: 4, giro: Math.PI / 4, largura: 1.3, fundo: 0.9 }), "hips");

  // ---------------------------------------------------------- braços
  for (const [lado, s] of [["left", 1], ["right", -1]]) {
    const L = (n) => lado + n;
    const inicio = soma(O[L("Shoulder")], [s * 0.03, -0.005, 0]);
    const { caminho, cortes } = caminhoPor([inicio, O[L("UpperArm")], O[L("LowerArm")], soma(O[L("Hand")], [s * 0.012, 0, 0])], 5);
    const ossos = [L("Shoulder"), L("UpperArm"), L("LowerArm")];
    const pesos = pesosDeCadeia(ossos, cortes);
    const raioDoBraco = (t) => {
      // Ombro cheio, bíceps, cotovelo fino, antebraço e pulso.
      const ombro = 0.064 * p.ombros;
      if (t < cortes[1]) return ombro * (0.92 + 0.08 * Math.sin((t / cortes[1]) * Math.PI * 0.5));
      if (t < cortes[2]) return misturar([ombro, 0, 0], [0.042, 0, 0], suave(cortes[1], cortes[2], t))[0] + 0.004 * Math.sin(((t - cortes[1]) / (cortes[2] - cortes[1])) * Math.PI);
      return misturar([0.043, 0, 0], [0.033, 0, 0], (t - cortes[2]) / (1 - cortes[2]))[0] + 0.005 * Math.sin(((t - cortes[2]) / (1 - cortes[2])) * Math.PI);
    };
    const mangaAte = r.manga === "longa" || temJaqueta ? 1 : r.manga === "curta" ? cortes[1] + (cortes[2] - cortes[1]) * 0.55 : 0;
    // Pele por baixo (só onde aparece), manga por cima.
    if (mangaAte < 1) M.pele.adicionar(tubo(caminho, raioDoBraco, { lados: 12, tampas: true }), pesos);
    if (mangaAte > 0) {
      const ate = Math.ceil(mangaAte * (caminho.length - 1));
      const trecho = caminho.slice(0, ate + 1);
      const k = (caminho.length - 1) / ate;
      const folga = mangaAte >= 1 ? 1.12 : 1.18;
      const malha = temJaqueta ? M.roupa : blusa;
      malha.adicionar(
        tubo(trecho, (t) => raioDoBraco(t / k) * folga + (mangaAte < 1 && t > 0.85 ? 0.004 : 0), { lados: 12 }),
        (v) => pesos({ ...v, t: v.t / k }),
      );
      // Barra da manga.
      const fim = trecho.at(-1);
      const dir = normal(sub(fim, trecho.at(-2)));
      malha.adicionar(tubo([alem(fim, sub(fim, dir), -0.012), alem(fim, sub(fim, dir), 0.004)], () => raioDoBraco(mangaAte) * folga + 0.006, { lados: 12 }), pesos({ t: mangaAte }).length > 0 ? (v) => pesos({ ...v, t: mangaAte }) : ossos[1]);
    }
    if (r.acessorios.includes("munhequeira")) {
      const pulso = soma(O[L("Hand")], [-s * 0.03, 0, 0]);
      M.detalhe.adicionar(tubo([soma(pulso, [-s * 0.025, 0, 0]), soma(pulso, [s * 0.01, 0, 0])], () => 0.042, { lados: 12 }), L("LowerArm"));
    }

    // Mão: palma achatada e dedos com ossos.
    const m = p.maos;
    const mao = O[L("Hand")];
    M.pele.adicionar(
      torno({ de: soma(mao, [-s * 0.012, 0, 0]), ate: soma(mao, [s * 0.088 * m, -0.004, 0]), perfil: perfilDeCapsula(0.04 * m, 0.044 * m, 0.25), lados: 12, largura: 1, fundo: 0.5 }),
      (v) => (v.t < 0.15 ? [[L("Hand"), 0.7], [L("LowerArm"), 0.3]] : [[L("Hand"), 1]]),
    );
    for (const [dedo, , , raioDedo] of DEDOS) {
      const nomes = FALANGES.map((f) => L(dedo + f));
      const pontas = nomes.map((n) => O[n]);
      const ultima = pontas[2];
      const fimDoDedo = soma(ultima, sub(ultima, pontas[1]));
      const { caminho: cam, cortes: cor } = caminhoPor([soma(pontas[0], [-s * 0.012, 0, 0]), ...pontas.slice(1), fimDoDedo], 3);
      M.pele.adicionar(tubo(cam, (t) => raioDedo * m * (1 - 0.15 * t), { lados: 8, fundo: 0.9 }), pesosDeCadeia(nomes, cor.slice(0, 3), 0.08));
    }
    const nomesPolegar = POLEGAR.map((f) => L("Thumb" + f));
    const pp = nomesPolegar.map((n) => O[n]);
    const fimPolegar = soma(pp[2], escala(normal(sub(pp[2], pp[1])), 0.026 * m));
    const { caminho: camP, cortes: corP } = caminhoPor([...pp, fimPolegar], 3);
    M.pele.adicionar(tubo(camP, (t) => 0.012 * m * (1.15 - 0.3 * t), { lados: 8 }), pesosDeCadeia(nomesPolegar, corP.slice(0, 3), 0.08));
  }

  // ---------------------------------------------------------- pernas e quadril
  M.calca.adicionar(
    torno({ de: soma(O.hips, [0, -0.13, 0]), ate: soma(O.hips, [0, 0.05, 0]), perfil: [[0, 0], [0.09 * p.quadril, 0.1], [0.148 * p.quadril, 0.45], [0.15 * p.quadril, 1]], lados: 16, fundo: 0.7 }),
    (v) => {
      if (v.t > 0.45 || Math.abs(v.p[0]) < 0.025) return [["hips", 1]];
      const w = 0.5 * (1 - suave(0.1, 0.45, v.t));
      return [["hips", 1 - w], [v.p[0] > 0 ? "leftUpperLeg" : "rightUpperLeg", w]];
    },
  );
  for (const [lado] of [["left", 1], ["right", -1]]) {
    const L = (n) => lado + n;
    const { caminho, cortes } = caminhoPor([soma(O[L("UpperLeg")], [0, 0.07, 0]), O[L("LowerLeg")], soma(O[L("Foot")], [0, 0.04, 0])], 6);
    const ossos = [L("UpperLeg"), L("LowerLeg")];
    const pesos = pesosDeCadeia(ossos, cortes, 0.08);
    const raioDaPerna = (t) => {
      if (t < cortes[1]) return 0.08 * p.quadril - 0.022 * suave(0, cortes[1], t);
      const k = (t - cortes[1]) / (1 - cortes[1]);
      return 0.055 + 0.008 * Math.sin(Math.min(1, k * 1.6) * Math.PI) - 0.014 * k;
    };
    if (r.calca === "reta") {
      // Calça reta, levemente larga embaixo, com barra dobrada.
      M.calca.adicionar(tubo(caminho, (t) => raioDaPerna(t) * 1.08 + 0.012 * suave(0.6, 1, t), { lados: 14 }), pesos);
      const fim = caminho.at(-1);
      M.calca.adicionar(tubo([soma(fim, [0, 0.0, 0]), soma(fim, [0, 0.035, 0])], () => raioDaPerna(1) * 1.08 + 0.02, { lados: 14 }), L("LowerLeg"));
    } else {
      const corte = Math.ceil((cortes[1] + 0.06) * (caminho.length - 1));
      const k = (caminho.length - 1) / corte;
      M.calca.adicionar(tubo(caminho.slice(0, corte + 1), (t) => raioDaPerna(t / k) * 1.15 + 0.006, { lados: 14 }), (v) => pesos({ ...v, t: v.t / k }));
      M.pele.adicionar(tubo(caminho, raioDaPerna, { lados: 12 }), pesos);
    }

    // Tênis de cano alto, com sola branca grossa.
    const pe = O[L("Foot")];
    const dedos = O[L("Toes")];
    const pesoDoPe = (v) => {
      const z = v.p[2];
      const w = suave(0.02, 0.08, z);
      return w > 0 ? [[L("Foot"), 1 - w], [L("Toes"), w]] : [[L("Foot"), 1]];
    };
    M.sola.adicionar(
      tubo(reta(soma(pe, [0, -0.072, -0.07]), soma(dedos, [0, -0.017, 0.075]), 6), (t) => 0.06 - 0.008 * Math.abs(t - 0.6), { lados: 12, largura: 0.38, fundo: 1.05 }),
      pesoDoPe,
    );
    M.tenis.adicionar(
      tubo(curva(soma(pe, [0, -0.035, -0.06]), soma(pe, [0, -0.02, 0.06]), soma(dedos, [0, 0.005, 0.062]), 8), (t) => 0.058 - 0.012 * suave(0.6, 1, t), { lados: 14, largura: 0.72, fundo: 1 }),
      pesoDoPe,
    );
    M.tenis.adicionar(tubo(reta(soma(pe, [0, -0.04, -0.012]), soma(pe, [0, 0.055, -0.015]), 3), (t) => 0.058 + 0.004 * t, { lados: 14 }), L("Foot"));
    // Língua do tênis e cadarço.
    M.tenis.adicionar(tubo(curva(soma(pe, [0, 0.03, 0.035]), soma(pe, [0, 0.06, 0.02]), soma(pe, [0, 0.075, 0.0]), 4), () => 0.016, { lados: 8, largura: 0.5, fundo: 1.6 }), L("Foot"));
    for (let i = 0; i < 3; i++) {
      const c = soma(pe, [0, 0.017 - i * 0.017, 0.045 + i * 0.022]);
      M.sola.adicionar(tubo([soma(c, [-0.024, 0, 0]), soma(c, [0.024, 0, 0])], () => 0.0045, { lados: 5 }), L("Foot"));
    }
  }

  // ---------------------------------------------------------- cabelo
  const naCabeca = (dir, folga = 1) => {
    const d = normal(dir);
    return soma(C, [d[0] * R * folga, d[1] * R * 1.04 * folga, d[2] * R * 0.98 * folga]);
  };
  const calota = (sobe = 0.05, recua = 0.12) => elipsoide(soma(C, [0, R * sobe, -R * recua]), R * 1.07, R * 1.06, R * 1.03, 18, 12);
  /** Mecha cônica e curva: nasce em `de` e vai até `ate` passando perto de `meio`. */
  const mecha = (de, meio, ate, grossura, opcoes = {}) => tubo(curva(de, meio, ate, 7), (t) => grossura * (0.45 + 0.55 * suave(0, 0.3, t)) * (1 - t) ** 0.8 + 0.002, { lados: 7, ...opcoes });
  const pesoDoCabeloLongo = (v) => (v.p[1] < C[1] - R * 0.9 ? [["head", 0.55], ["upperChest", 0.45]] : [["head", 1]]);

  switch (r.cabelo) {
    case "espetado": {
      M.cabelo.adicionar(calota(), "head");
      const pontas = [
        [0, 1, 0.35, 0.16], [0.45, 0.9, 0.3, 0.14], [-0.45, 0.9, 0.3, 0.14], [0.2, 1, -0.2, 0.15], [-0.25, 1, -0.25, 0.15],
        [0.7, 0.55, 0.0, 0.12], [-0.7, 0.55, 0.0, 0.12], [0.45, 0.6, -0.6, 0.13], [-0.45, 0.6, -0.6, 0.13], [0, 0.6, -0.8, 0.14],
        [0.25, 0.55, 0.75, 0.12], [-0.3, 0.55, 0.75, 0.12], [0.6, 0.3, 0.55, 0.1], [-0.6, 0.3, 0.55, 0.1],
      ];
      for (const [x, y, z, comp] of pontas) {
        const d = normal([x, y, z]);
        const base = naCabeca(d, 0.82);
        const ponta = soma(base, escala(normal(soma(d, [0, 0.55, -0.15])), comp * cab));
        M.cabelo.adicionar(mecha(base, soma(base, escala(d, comp * 0.55 * cab)), ponta, 0.05 * cab), "head");
      }
      break;
    }
    case "moicano": {
      // Laterais raspadas (sombra do cabelo) e a crista de pontas para trás.
      M.cabelo.adicionar(elipsoide(soma(C, [0, R * 0.62, -R * 0.12]), R * 0.32, R * 0.5, R * 0.95, 12, 8), "head");
      for (let i = 0; i < 7; i++) {
        const a = -1.05 + i * 0.36;
        const d = [0, Math.cos(a), Math.sin(a) * 0.95];
        const base = naCabeca(d, 0.9);
        const comp = (0.13 + 0.05 * Math.sin((i / 6) * Math.PI)) * cab;
        const saida = normal(soma(d, [0, 0.35, -0.55]));
        M.cabelo.adicionar(mecha(base, soma(base, escala(d, comp * 0.5)), soma(base, escala(saida, comp)), 0.055 * cab, { largura: 1, fundo: 0.35 }), "head");
      }
      break;
    }
    case "franja": {
      M.cabelo.adicionar(calota(0.07, 0.1), "head");
      // Franja caída para um lado sobre a testa.
      for (let i = 0; i < 6; i++) {
        const x = -0.55 + i * 0.22;
        const base = naCabeca([x * 0.6, 0.9, 0.45], 0.98);
        const ponta = soma(C, [x * R + R * 0.35, R * 0.15 - Math.abs(i - 2) * R * 0.04, sup(x * R + R * 0.35, R * 0.15) + R * 0.06]);
        M.cabelo.adicionar(mecha(base, soma(naCabeca([x, 0.6, 1], 1.15), [0, 0, 0]), ponta, 0.055 * cab, { largura: 1, fundo: 0.5 }), "head");
      }
      for (const s of [1, -1]) {
        for (let i = 0; i < 3; i++) {
          const base = naCabeca([s * 0.85, 0.55, 0.1 - i * 0.35], 0.92);
          const ponta = soma(base, [s * R * 0.08, -R * (0.8 + i * 0.1), R * 0.02]);
          M.cabelo.adicionar(mecha(base, soma(base, [s * R * 0.16, -R * 0.35, 0]), ponta, 0.05 * cab, { largura: 0.6 }), "head");
        }
      }
      for (let i = 0; i < 5; i++) {
        const x = -0.6 + i * 0.3;
        const base = naCabeca([x, 0.4, -0.9], 0.95);
        M.cabelo.adicionar(mecha(base, soma(base, [x * R * 0.2, -R * 0.2, -R * 0.25]), soma(base, [x * R * 0.25, -R * 0.65, -R * 0.1]), 0.06 * cab), "head");
      }
      break;
    }
    case "longo": {
      M.cabelo.adicionar(calota(0.06, 0.08), "head");
      // Divisão no meio e mechas caindo até as costas.
      for (const s of [1, -1]) {
        M.cabelo.adicionar(mecha(naCabeca([s * 0.05, 1, 0.3], 1), naCabeca([s * 0.8, 0.6, 0.75], 1.14), naCabeca([s * 1, -0.15, 0.55], 1.1), 0.075 * cab, { fundo: 0.45 }), "head");
      }
      for (let i = 0; i < 16; i++) {
        const a = (i / 15 - 0.5) * Math.PI * 1.25;
        const d = [Math.sin(a), 0.35, -Math.cos(a)];
        const base = naCabeca(d, 0.98);
        const lateral = [Math.sin(a) * R * 0.3, 0, -Math.cos(a) * R * 0.3];
        const queda = (1.9 + 0.35 * Math.cos(i * 1.7)) * R * cab;
        M.cabelo.adicionar(mecha(base, soma(base, soma(lateral, [0, -queda * 0.4, 0])), soma(base, soma(escala(lateral, 0.7), [0, -queda, -R * 0.12])), 0.072 * cab, { fundo: 0.55 }), pesoDoCabeloLongo);
      }
      break;
    }
    case "rabo": {
      M.cabelo.adicionar(calota(0.05, 0.1), "head");
      const prendedor = naCabeca([0, 0.55, -1], 1.02);
      M.detalhe.adicionar(tubo([soma(prendedor, [0, 0.01, 0.012]), soma(prendedor, [0, -0.005, -0.02])], () => 0.03, { lados: 10 }), "head");
      M.cabelo.adicionar(
        tubo(curva(soma(prendedor, [0, 0, -0.01]), soma(prendedor, [0, 0.03, -R * 1.2]), soma(prendedor, [0, -R * 2.1, -R * 0.9]), 10), (t) => 0.05 * cab * (1 + 0.7 * Math.sin(t * Math.PI)) * (1 - 0.6 * t), { lados: 10 }),
        (v) => (v.t > 0.55 ? [["head", 0.6], ["upperChest", 0.4]] : [["head", 1]]),
      );
      for (const s of [1, -1]) M.cabelo.adicionar(mecha(naCabeca([s * 0.3, 0.95, 0.35], 1), naCabeca([s * 0.9, 0.5, 0.85], 1.12), naCabeca([s * 0.9, -0.2, 0.6], 1.08), 0.045 * cab), "head");
      break;
    }
    case "black": {
      const centro = soma(C, [0, R * 0.4, -R * 0.12]);
      M.cabelo.adicionar(elipsoide(centro, R * 1.38, R * 1.12, R * 1.28, 18, 12), "head");
      // Cachos: bolinhas na borda deixam a silhueta fofa.
      for (let i = 0; i < 26; i++) {
        const y = 1 - (i / 25) * 1.7;
        const a = i * 2.4;
        const raioXZ = Math.sqrt(Math.max(0, 1 - y * y));
        const d = [Math.cos(a) * raioXZ, y, Math.sin(a) * raioXZ];
        if (d[2] > 0.45 && d[1] < 0.35) continue; // deixa o rosto livre
        const c = soma(centro, [d[0] * R * 1.32, d[1] * R * 1.05, d[2] * R * 1.2]);
        M.cabelo.adicionar(elipsoide(c, R * 0.36, R * 0.34, R * 0.36, 10, 6), "head");
      }
      break;
    }
    case "careca":
      break;
  }

  // ---------------------------------------------------------- acessórios
  const tem = (a) => r.acessorios.includes(a);
  if (tem("oculos")) {
    // Óculos escuros de roqueiro: lentes grandes, armação e hastes.
    for (const s of [1, -1]) {
      const ex = s * R * 0.36;
      const ey = -R * 0.02;
      const lente = formaDeDisco(ex, ey, ew * 1.45, eh * 1.15, 18, 1);
      M.lente.adicionar(adesivo(sup, C, lente.forma, lente.indices, R * 0.09), "head");
      const contorno = Array.from({ length: 19 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2;
        const x = ex + Math.cos(a) * ew * 1.5;
        const y = ey + Math.sin(a) * eh * 1.2;
        return soma(C, [x, y, sup(x, y) + R * 0.09]);
      });
      M.metal.adicionar(tubo(contorno, () => 0.0035, { lados: 5, tampas: false }), "head");
      const haste = soma(C, [s * R * 0.62, ey + eh * 0.6, sup(s * R * 0.62, ey + eh * 0.6) + R * 0.07]);
      M.metal.adicionar(tubo([haste, soma(C, [s * R * 1.02, ey + eh * 0.6, -R * 0.1])], () => 0.004, { lados: 5 }), "head");
    }
    M.metal.adicionar(tubo(curva(soma(C, [R * 0.12, R * 0.08, sup(R * 0.12, R * 0.08) + R * 0.09]), soma(C, [0, R * 0.14, sup(0, R * 0.12) + R * 0.12]), soma(C, [-R * 0.12, R * 0.08, sup(-R * 0.12, R * 0.08) + R * 0.09]), 4), () => 0.0035, { lados: 5 }), "head");
  }
  if (tem("bandana")) {
    M.detalhe.adicionar(torno({ de: soma(C, [0, R * 0.38, -R * 0.02]), ate: soma(C, [0, R * 0.62, -R * 0.06]), perfil: [[R * 1.08, 0], [R * 1.1, 0.5], [R * 1.04, 1]], lados: 20, fundo: 1.02 }), "head");
    const no = naCabeca([0, 0.45, -1], 1.08);
    for (const s of [1, -1]) M.detalhe.adicionar(mecha(no, soma(no, [s * 0.03, -0.03, -0.03]), soma(no, [s * 0.05, -0.1, -0.02]), 0.022, { fundo: 0.35 }), (v) => (v.t > 0.5 ? [["head", 0.7], ["upperChest", 0.3]] : [["head", 1]]));
  }
  if (tem("bone")) {
    // Boné virado para trás.
    M.detalhe.adicionar(torno({ de: soma(C, [0, R * 0.32, -R * 0.06]), ate: soma(C, [0, R * 1.18, -R * 0.08]), perfil: [[R * 1.09, 0], [R * 1.07, 0.3], [R * 0.85, 0.75], [0, 1]], lados: 20 }), "head");
    M.detalhe.adicionar(tubo(reta(naCabeca([0, 0.35, -1], 1.05), soma(naCabeca([0, 0.35, -1], 1.05), [0, -0.01, -R * 0.75]), 3), () => R * 0.52, { lados: 14, largura: 0.1, fundo: 1 }), "head");
    M.metal.adicionar(elipsoide(soma(C, [0, R * 1.18, -R * 0.08]), 0.012, 0.008, 0.012, 8, 4), "head");
  }
  if (tem("corrente")) {
    const elos = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      elos.push(soma(O.upperChest, [Math.cos(a) * 0.085, 0.07 - Math.sin(a) * 0.12, 0.085 * p.barriga + Math.sin(a) * 0.035]));
    }
    elos.forEach((c, i) => M.metal.adicionar(elipsoide(c, 0.009, 0.009, 0.006, 6, 4), i < 3 || i > 13 ? "upperChest" : "upperChest"));
    M.metal.adicionar(torno({ de: soma(elos[8], [0, -0.012, 0.005]), ate: soma(elos[8], [0, -0.05, 0.01]), perfil: [[0, 0], [0.018, 0.25], [0.012, 0.7], [0, 1]], lados: 3 }), "upperChest");
  }
  if (tem("brinco")) {
    for (const s of [1, -1]) M.metal.adicionar(tubo(Array.from({ length: 11 }, (_, i) => soma(C, [s * R * 1.0 + s * Math.sin((i / 10) * Math.PI * 2) * 0.004, -R * 0.38 + Math.cos((i / 10) * Math.PI * 2) * 0.014, 0.006 + Math.sin((i / 10) * Math.PI * 2) * 0.014])), () => 0.0028, { lados: 5, tampas: false }), "head");
  }
  if (tem("barba")) {
    // Cavanhaque.
    const forma = formaDeDisco(0, my - mw * 0.75, mw * 0.55, mw * 0.55, 14, 2);
    M.cabelo.adicionar(adesivo(sup, C, forma.forma, forma.indices, 0.004), "head");
    M.cabelo.adicionar(mecha(soma(C, [0, -R * 0.82, sup(0, -R * 0.82) - 0.01]), soma(C, [0, -R * 1.0, sup(0, -R * 0.82) + 0.002]), soma(C, [0, -R * 1.18, sup(0, -R * 0.82) - 0.02]), 0.026, { fundo: 0.6 }), "head");
    const bigode = formaDeFaixa(10, (u) => {
      const x = u * mw * 1.05;
      const y = my + mw * 0.32 - Math.abs(u) ** 2 * mw * 0.3;
      return [[x, y + mw * 0.12 * (1 - Math.abs(u) * 0.6)], [x, y - mw * 0.05]];
    });
    M.cabelo.adicionar(adesivo(sup, C, bigode.forma, bigode.indices, 0.0045), "head");
  }

  const k = r.altura / 1.6;
  const malhas = Object.values(M).filter((m) => m.posicoes.length);
  for (const m of malhas) {
    m.posicoes = m.posicoes.map((v) => escala(v, k));
    for (const nome of Object.keys(m.alvos)) m.alvos[nome] = m.alvos[nome].map((v) => escala(v, k));
  }
  for (const o of esqueleto) o.pos = escala(o.pos, k);
  return { esqueleto, malhas };
}

// ================================================================ glTF / VRM

const EXPRESSOES = ["happy", "sad", "angry", "relaxed", "surprised", "blink"];

const corLinear = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
/** Sombra do MToon: a mesma cor, mais escura e puxada para o roxo/vinho, como luz de palco. */
const corDeSombra = (lin) => [lin[0] * 0.5 + 0.012, lin[1] * 0.36 + 0.004, lin[2] * 0.52 + 0.022];

function materialDe(nome, r) {
  const fixo = {
    Body_00_SKIN: [r.cores.pele],
    Tops_00_CLOTH: [r.cores.roupa],
    Inner_00_SHIRT: [r.cores.camiseta],
    Bottoms_00_CLOTH: [r.cores.calca],
    Shoes_00_CLOTH: [r.cores.calcados],
    Shoes_00_SOLE: ["#ece6dc"],
    Hair_00_HAIR: [r.cores.cabelo],
    Brow_00_HAIR: [r.cores.cabelo],
    EyeWhite_00_FACE: ["#f7f3ee", { sombra: false }],
    EyeIris_00_EYE: [r.cores.olhos, { sombra: false }],
    FaceLine_00_FACE: ["#1a1210", { sombra: false }],
    FaceMouth_00_FACE: ["#5a1f1f", { sombra: false }],
    Teeth_00_FACE: ["#f2ede6", { sombra: false }],
    Accessory_00_ACCE: [r.cores.detalhe],
    Belt_00_ACCE: ["#2a1d17"],
    Metal_00_ACCE: ["#c9c6c0", { rim: 0.6 }],
    Lens_00_ACCE: ["#16131a", { rim: 0.8 }],
  }[nome];
  const [hex, { sombra = true, rim = 0.25 } = {}] = fixo;
  const cor = corLinear(hex);
  const rosto = /_FACE$|_EYE$/.test(nome);
  return {
    name: nome,
    pbrMetallicRoughness: { baseColorFactor: [...cor, 1], metallicFactor: 0, roughnessFactor: 0.9 },
    doubleSided: nome === "Tops_00_CLOTH" && r.jaqueta,
    extensions: {
      KHR_materials_unlit: {},
      VRMC_materials_mtoon: {
        specVersion: "1.0",
        transparentWithZWrite: false,
        renderQueueOffsetNumber: 0,
        shadeColorFactor: sombra ? corDeSombra(cor) : cor.map((c) => c * 0.85),
        shadingShiftFactor: -0.1,
        shadingToonyFactor: 0.92,
        giEqualizationFactor: 0.9,
        matcapFactor: [0, 0, 0],
        parametricRimColorFactor: [rim, rim * 0.85, rim * 1.1],
        parametricRimFresnelPowerFactor: 3.5,
        parametricRimLiftFactor: 0.05,
        rimLightingMixFactor: 1,
        outlineWidthMode: rosto ? "none" : "worldCoordinates",
        outlineWidthFactor: rosto ? 0 : 0.0042,
        outlineColorFactor: [0.018, 0.01, 0.012],
        outlineLightingMixFactor: 0,
        uvAnimationScrollXSpeedFactor: 0,
        uvAnimationScrollYSpeedFactor: 0,
        uvAnimationRotationSpeedFactor: 0,
      },
    },
  };
}

function gerarVRM(r) {
  const { esqueleto, malhas } = montarPersonagem(r);
  const buffers = [];
  let tamanhoTotal = 0;
  const bufferViews = [];
  const accessors = [];
  const pad4 = (n) => (n + 3) & ~3;

  function anexar(typed, alvo) {
    const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    const inicio = tamanhoTotal;
    buffers.push(bytes);
    tamanhoTotal += bytes.length;
    const resto = pad4(tamanhoTotal) - tamanhoTotal;
    if (resto) {
      buffers.push(Buffer.alloc(resto));
      tamanhoTotal += resto;
    }
    bufferViews.push({ buffer: 0, byteOffset: inicio, byteLength: bytes.length, ...(alvo ? { target: alvo } : {}) });
    return bufferViews.length - 1;
  }
  function acessor(lista, tipo, comp, { minmax = false, alvo } = {}) {
    const n = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[tipo];
    const plano = lista.flat();
    const typed = comp === 5126 ? Float32Array.from(plano) : comp === 5123 ? Uint16Array.from(plano) : Uint32Array.from(plano);
    const a = { bufferView: anexar(typed, alvo), componentType: comp, count: lista.length, type: tipo };
    if (minmax) {
      a.min = Array.from({ length: n }, (_, i) => lista.reduce((m, v) => Math.min(m, v[i]), Infinity));
      a.max = Array.from({ length: n }, (_, i) => lista.reduce((m, v) => Math.max(m, v[i]), -Infinity));
    }
    accessors.push(a);
    return accessors.length - 1;
  }

  const nodes = [{ name: "Armature", children: [] }];
  const indiceDoOsso = {};
  for (const o of esqueleto) {
    indiceDoOsso[o.nome] = nodes.length;
    const pai = o.pai ? esqueleto.find((x) => x.nome === o.pai).pos : [0, 0, 0];
    nodes.push({ name: `J_${o.nome}`, translation: sub(o.pos, pai), children: [] });
  }
  for (const o of esqueleto) (o.pai ? nodes[indiceDoOsso[o.pai]] : nodes[0]).children.push(indiceDoOsso[o.nome]);
  for (const no of nodes) if (!no.children.length) delete no.children;
  const ordemDaJunta = Object.fromEntries(esqueleto.map((o, i) => [o.nome, i]));
  const inversas = esqueleto.map((o) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -o.pos[0], -o.pos[1], -o.pos[2], 1]);
  const skins = [{ name: "Corpo", joints: esqueleto.map((o) => indiceDoOsso[o.nome]), skeleton: indiceDoOsso.hips, inverseBindMatrices: acessor(inversas, "MAT4", 5126) }];

  const meshes = [];
  const materials = [];
  const binds = Object.fromEntries(EXPRESSOES.map((e) => [e, []]));
  let triangulos = 0;
  for (const m of malhas) {
    materials.push(materialDe(m.material, r));
    const nomesDosAlvos = EXPRESSOES.filter((e) => m.alvos[e]);
    m.completarAlvos(nomesDosAlvos);
    const juntasV = [];
    const pesosV = [];
    for (const lista of m.pesos) {
      const top = [...lista].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const j = top.map(([osso]) => {
        if (!(osso in ordemDaJunta)) throw new Error(`Osso desconhecido: ${osso}`);
        return ordemDaJunta[osso];
      });
      const w = top.map(([, peso]) => peso);
      while (j.length < 4) {
        j.push(0);
        w.push(0);
      }
      const t = w.reduce((s, x) => s + x, 0);
      juntasV.push(j);
      pesosV.push(w.map((x) => x / t));
    }
    triangulos += m.indices.length / 3;
    const primitiva = {
      attributes: {
        POSITION: acessor(m.posicoes, "VEC3", 5126, { minmax: true, alvo: 34962 }),
        NORMAL: acessor(m.normais(), "VEC3", 5126, { alvo: 34962 }),
        JOINTS_0: acessor(juntasV, "VEC4", 5123, { alvo: 34962 }),
        WEIGHTS_0: acessor(pesosV, "VEC4", 5126, { alvo: 34962 }),
      },
      indices: acessor(m.indices.map((i) => [i]), "SCALAR", m.posicoes.length > 65535 ? 5125 : 5123, { alvo: 34963 }),
      material: materials.length - 1,
      mode: 4,
    };
    if (nomesDosAlvos.length) primitiva.targets = nomesDosAlvos.map((e) => ({ POSITION: acessor(m.alvos[e], "VEC3", 5126, { minmax: true, alvo: 34962 }) }));
    const nomeDaMalha = m.material.replace(/_00_.*/, "");
    meshes.push({ name: nomeDaMalha, primitives: [primitiva], ...(nomesDosAlvos.length ? { extras: { targetNames: nomesDosAlvos }, weights: nomesDosAlvos.map(() => 0) } : {}) });
    const no = nodes.length;
    nodes.push({ name: nomeDaMalha, mesh: meshes.length - 1, skin: 0 });
    nodes[0].children.push(no);
    nomesDosAlvos.forEach((e, index) => binds[e].push({ node: no, index, weight: 1 }));
  }

  const humanBones = Object.fromEntries(esqueleto.map((o) => [o.nome, { node: indiceDoOsso[o.nome] }]));
  const preset = {};
  for (const e of EXPRESSOES) preset[e] = { morphTargetBinds: binds[e], isBinary: false, overrideBlink: e === "blink" ? "none" : e === "happy" || e === "surprised" ? "block" : "blend", overrideLookAt: "none", overrideMouth: "none" };

  const json = {
    asset: { version: "2.0", generator: "riffrush/scripts/gerar-personagem.mjs" },
    extensionsUsed: ["KHR_materials_unlit", "VRMC_materials_mtoon", "VRMC_vrm"],
    scene: 0,
    scenes: [{ name: "Cena", nodes: [0] }],
    nodes,
    meshes,
    skins,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: tamanhoTotal }],
    extensions: {
      VRMC_vrm: {
        specVersion: "1.0",
        meta: {
          name: r.nome,
          version: "2",
          authors: [r.autor],
          licenseUrl: "https://vrm.dev/licenses/1.0/",
          avatarPermission: "everyone",
          allowExcessivelyViolentUsage: false,
          allowExcessivelySexualUsage: false,
          commercialUsage: "personalNonProfit",
          allowPoliticalOrReligiousUsage: false,
          allowAntisocialOrHateUsage: false,
          creditNotation: "unnecessary",
          allowRedistribution: true,
          modification: "allowModificationRedistribution",
        },
        humanoid: { humanBones },
        expressions: { preset },
      },
    },
  };

  const textoJson = Buffer.from(JSON.stringify(json));
  const jsonPad = Buffer.concat([textoJson, Buffer.alloc(pad4(textoJson.length) - textoJson.length, 0x20)]);
  const bin = Buffer.concat(buffers);
  const cab = Buffer.alloc(12);
  cab.writeUInt32LE(0x46546c67, 0);
  cab.writeUInt32LE(2, 4);
  cab.writeUInt32LE(12 + 8 + jsonPad.length + 8 + bin.length, 8);
  const bloco = (dados, tipo) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(dados.length, 0);
    h.writeUInt32LE(tipo, 4);
    return Buffer.concat([h, dados]);
  };
  return { glb: Buffer.concat([cab, bloco(jsonPad, 0x4e4f534a), bloco(bin, 0x004e4942)]), triangulos };
}

// ================================================================ linha de comando

const receitas = process.argv.slice(2);
if (!receitas.length) {
  console.error("Uso: node scripts/gerar-personagem.mjs personagens/<id>.json [...]");
  process.exit(1);
}
for (const caminho of receitas) {
  const receita = lerReceita(resolve(caminho));
  const { glb, triangulos } = gerarVRM(receita);
  const destino = resolve("public/modelos/personagens", `${receita.id}.vrm`);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, glb);
  console.log(`${receita.id}.vrm  ${triangulos} triângulos  ${(glb.length / 1024).toFixed(0)} KB`);
}
