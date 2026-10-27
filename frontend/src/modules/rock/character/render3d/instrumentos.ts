import * as THREE from "three";
import { cores } from "@/modules/rock/tema";
import type { Instrumento } from "../catalogo";
import { parte } from "./materiais";

/**
 * Instrumentos desenhados com formas simples, presos a um osso humanoide do VRM ou levados pelas mãos.
 * Medidas em metros, para um personagem de cerca de 1,6 m.
 */
export interface Montado {
  objeto: THREE.Object3D;
  /** "maos": o instrumento não segue um osso; `encaixarNasMaos` o posiciona a cada quadro. */
  osso: "rightHand" | "leftHand" | "maos";
}

const PRETO = "#16110f";
const MARFIM = "#e8e4dc";
const MADEIRA = "#d9b98a";

const CIMA = new THREE.Vector3(0, 1, 0);
const DISTANCIA_MINIMA_ENTRE_AS_MAOS = 0.08;
/** Quanto o braço padrão sobe, em relação ao quanto vai para o lado. */
const INCLINACAO_DO_BRACO_PADRAO = 0.6;
/** O corpo fica um pouco atrás da mão, para ela palhetar por cima das cordas. */
const RECUO_DO_CORPO = 0.05;
/** Do osso do tronco até a frente da barriga, mais meia espessura do instrumento. */
const FOLGA_DO_TRONCO = 0.12;

const eixoX = new THREE.Vector3();
const eixoY = new THREE.Vector3();
const eixoZ = new THREE.Vector3();
const desvio = new THREE.Vector3();
const base = new THREE.Matrix4();

/**
 * Põe o instrumento entre as mãos: a origem (onde se palheta) na mão direita e o braço (+Y)
 * apontando para a mão esquerda, com a face (+Z) para a frente do personagem.
 * Assim ele acompanha qualquer animação. Com `tronco`, ele é empurrado para fora do corpo quando a mão
 * fica colada no peito. Tudo no espaço do pai do objeto.
 */
export function encaixarNasMaos(objeto: THREE.Object3D, maoQuePalheta: THREE.Vector3, maoDoBraco: THREE.Vector3, frente: THREE.Vector3, tronco?: THREE.Vector3) {
  eixoY.subVectors(maoDoBraco, maoQuePalheta);
  // Com as mãos quase juntas a direção entre elas não diz nada: o braço sobe para a esquerda do personagem.
  if (eixoY.length() < DISTANCIA_MINIMA_ENTRE_AS_MAOS) eixoY.crossVectors(CIMA, frente).normalize().addScaledVector(CIMA, INCLINACAO_DO_BRACO_PADRAO);
  eixoY.normalize();
  eixoZ.copy(frente).addScaledVector(eixoY, -frente.dot(eixoY));
  // Braço apontando direto para a frente: qualquer face perpendicular serve.
  if (eixoZ.lengthSq() < 1e-6) eixoZ.set(0, 1, 0).addScaledVector(eixoY, -eixoY.y);
  eixoZ.normalize();
  eixoX.crossVectors(eixoY, eixoZ);
  objeto.quaternion.setFromRotationMatrix(base.makeBasis(eixoX, eixoY, eixoZ));
  objeto.position.copy(maoQuePalheta).addScaledVector(eixoZ, -RECUO_DO_CORPO);
  if (tronco) {
    const naFrente = desvio.subVectors(objeto.position, tronco).dot(eixoZ);
    if (naFrente < FOLGA_DO_TRONCO) objeto.position.addScaledVector(eixoZ, FOLGA_DO_TRONCO - naFrente);
  }
}

function posicionar<T extends THREE.Object3D>(objeto: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
  objeto.position.set(x, y, z);
  objeto.rotation.set(rx, ry, rz);
  return objeto;
}

/** Envolve a peça num grupo, para `encaixarNasMaos` mexer no grupo sem perder o ajuste da peça. */
function noEncaixe(peca: THREE.Object3D) {
  const encaixe = new THREE.Group();
  encaixe.add(peca);
  return encaixe;
}

const METAL = "#c9c6c0";
const ESCALA = "#2a1a12";

/** Malha com nome, para os testes e para achar a peça na cena. */
function peca(nome: string, geometria: THREE.BufferGeometry, cor: string, comContorno = true) {
  const malha = parte(geometria, cor, comContorno);
  malha.name = nome;
  return malha;
}

/** Contorno do corpo em V, como a da logo: duas asas com pontas arredondadas e o recorte entre elas. */
function formaDoCorpo() {
  const forma = new THREE.Shape();
  forma.moveTo(0, 0.13);
  forma.quadraticCurveTo(0.09, 0.1, 0.12, -0.02);
  forma.lineTo(0.215, -0.33);
  forma.quadraticCurveTo(0.235, -0.41, 0.17, -0.415);
  forma.quadraticCurveTo(0.125, -0.415, 0.11, -0.38);
  forma.quadraticCurveTo(0.06, -0.24, 0, -0.17);
  forma.quadraticCurveTo(-0.06, -0.24, -0.11, -0.38);
  forma.quadraticCurveTo(-0.125, -0.415, -0.17, -0.415);
  forma.quadraticCurveTo(-0.235, -0.41, -0.215, -0.33);
  forma.lineTo(-0.12, -0.02);
  forma.quadraticCurveTo(-0.09, 0.1, 0, 0.13);
  return forma;
}

/** Escudo (pickguard): acompanha a asa de cima, por baixo das cordas. */
function formaDoEscudo() {
  const forma = new THREE.Shape();
  forma.moveTo(-0.035, 0.1);
  forma.quadraticCurveTo(-0.08, 0.06, -0.1, -0.03);
  forma.lineTo(-0.165, -0.24);
  forma.quadraticCurveTo(-0.13, -0.26, -0.09, -0.2);
  forma.lineTo(-0.035, -0.08);
  forma.closePath();
  return forma;
}

/** Mão (headstock) em ponta de flecha, para combinar com o corpo. */
function formaDaMao() {
  const forma = new THREE.Shape();
  forma.moveTo(-0.024, 0);
  forma.lineTo(-0.045, 0.1);
  forma.quadraticCurveTo(-0.04, 0.17, 0.005, 0.2);
  forma.lineTo(0.045, 0.1);
  forma.lineTo(0.024, 0);
  forma.closePath();
  return forma;
}

const chapa = (forma: THREE.Shape, espessura: number, chanfro = 0) =>
  new THREE.ExtrudeGeometry(forma, { depth: espessura, bevelEnabled: chanfro > 0, bevelSize: chanfro, bevelThickness: chanfro, bevelSegments: 2, curveSegments: 10 });

/**
 * Guitarra em V, como a da logo. O baixo é a mesma forma com braço mais longo e 4 cordas.
 * Origem onde a mão palheta, +Y para o braço e +Z para a frente; medidas em metros.
 */
function guitarraEmV(comprimentoDoBraco: number, cordas: number) {
  const g = new THREE.Group();
  const frente = 0.02;

  g.add(peca("corpo", chapa(formaDoCorpo(), 0.032, 0.008).translate(0, 0, -0.016), cores.primaria));
  g.add(posicionar(peca("escudo", chapa(formaDoEscudo(), 0.003), MARFIM, false), 0, 0, frente + 0.006));

  // Captadores (humbuckers) com a moldura e os polos, ponte e cordal.
  for (const y of [-0.005, -0.075]) {
    g.add(posicionar(peca("moldura", new THREE.BoxGeometry(0.082, 0.042, 0.006), PRETO, false), 0, y, frente + 0.008));
    g.add(posicionar(peca("captador", new THREE.BoxGeometry(0.072, 0.034, 0.01), PRETO), 0, y, frente + 0.012));
    for (let i = 0; i < cordas; i++) {
      const x = (i - (cordas - 1) / 2) * (cordas === 4 ? 0.014 : 0.0105);
      g.add(posicionar(peca("polo", new THREE.CylinderGeometry(0.0028, 0.0028, 0.004, 6), METAL, false), x, y + 0.008, frente + 0.017, Math.PI / 2));
    }
  }
  g.add(posicionar(peca("ponte", new THREE.BoxGeometry(0.075, 0.016, 0.012), METAL), 0, -0.125, frente + 0.012));
  g.add(posicionar(peca("cordal", new THREE.BoxGeometry(0.08, 0.012, 0.008), METAL), 0, -0.16, frente + 0.01));
  // Botões de volume e tom na asa de baixo.
  for (const [x, y] of [[0.1, -0.2], [0.125, -0.26], [0.15, -0.32]]) {
    g.add(posicionar(peca("botao", new THREE.CylinderGeometry(0.011, 0.012, 0.012, 12), METAL), x, y, frente + 0.012, Math.PI / 2));
  }

  // Braço: madeira por baixo, escala escura por cima com trastes e marcações.
  const inicio = 0.06;
  const largura = cordas === 4 ? 0.052 : 0.046;
  const braco = new THREE.BoxGeometry(largura, comprimentoDoBraco, 0.022).translate(0, inicio + comprimentoDoBraco / 2, frente - 0.006);
  g.add(peca("braco", braco, MADEIRA));
  const topoDoBraco = frente + 0.005;
  g.add(posicionar(peca("escala", new THREE.BoxGeometry(largura + 0.002, comprimentoDoBraco, 0.006), ESCALA, false), 0, inicio + comprimentoDoBraco / 2, topoDoBraco + 0.003));
  const pestana = inicio + comprimentoDoBraco;
  const ponte = -0.125;
  const escalaTotal = pestana - ponte;
  // Trastes na distância de verdade: cada um encurta a corda em 2^(1/12).
  for (let n = 1; n <= 22; n++) {
    const y = pestana - escalaTotal * (1 - 2 ** (-n / 12));
    if (y < inicio + 0.01) break;
    g.add(posicionar(peca("traste", new THREE.BoxGeometry(largura + 0.002, 0.0025, 0.003), METAL, false), 0, y, topoDoBraco + 0.0065));
    if ([3, 5, 7, 9, 15, 17].includes(n) || n === 12) {
      const anterior = pestana - escalaTotal * (1 - 2 ** (-(n - 1) / 12));
      const meio = (y + anterior) / 2;
      for (const x of n === 12 ? [-0.012, 0.012] : [0]) g.add(posicionar(peca("marcacao", new THREE.CylinderGeometry(0.0035, 0.0035, 0.002, 10), MARFIM, false), x, meio, topoDoBraco + 0.0062, Math.PI / 2));
    }
  }
  g.add(posicionar(peca("pestana", new THREE.BoxGeometry(largura + 0.002, 0.005, 0.008), MARFIM, false), 0, pestana, topoDoBraco + 0.004));

  // Mão inclinada para trás, com as tarraxas dos dois lados.
  const mao = new THREE.Group();
  mao.name = "mao";
  posicionar(mao, 0, pestana + 0.003, frente - 0.002, -0.22);
  mao.add(peca("mao", chapa(formaDaMao(), 0.016, 0.003).translate(0, 0, -0.008), cores.primaria));
  for (let i = 0; i < cordas; i++) {
    const lado = i < cordas / 2 ? -1 : 1;
    const ordem = i % (cordas / 2);
    const y = 0.04 + ordem * (cordas === 4 ? 0.05 : 0.04);
    const x = lado * (0.03 + 0.012 * (y / 0.1));
    mao.add(posicionar(peca("tarraxa", new THREE.CylinderGeometry(0.004, 0.004, 0.026, 8), METAL, false), x + lado * 0.012, y, 0, 0, 0, Math.PI / 2));
    mao.add(posicionar(peca("chave", new THREE.BoxGeometry(0.008, 0.014, 0.004), METAL), x + lado * 0.026, y, 0));
    mao.add(posicionar(peca("pino", new THREE.CylinderGeometry(0.003, 0.003, 0.01, 6), METAL, false), x * 0.55, y, 0.012, Math.PI / 2));
  }
  g.add(mao);

  // Cordas: da ponte até a pestana, abrindo um pouco no caminho.
  for (let i = 0; i < cordas; i++) {
    const t = (i - (cordas - 1) / 2) / ((cordas - 1) / 2);
    const naPonte = new THREE.Vector3(t * (cordas === 4 ? 0.021 : 0.026), ponte, frente + 0.018);
    const naPestana = new THREE.Vector3(t * (largura / 2 - 0.006), pestana, topoDoBraco + 0.009);
    const comprimento = naPonte.distanceTo(naPestana);
    const grossura = (cordas === 4 ? 0.0016 : 0.0008) + (1 - (t + 1) / 2) * 0.0007;
    const corda = peca("corda", new THREE.CylinderGeometry(grossura, grossura, comprimento, 4), MARFIM, false);
    corda.position.copy(naPonte).add(naPestana).multiplyScalar(0.5);
    corda.quaternion.setFromUnitVectors(CIMA, naPestana.clone().sub(naPonte).normalize());
    g.add(corda);
  }
  return g;
}

export function criarInstrumento(instrumento: Instrumento): Montado[] {
  switch (instrumento) {
    case "guitarra":
    case "baixo": {
      const guitarra = instrumento === "baixo" ? guitarraEmV(0.72, 4) : guitarraEmV(0.55, 6);
      guitarra.scale.setScalar(0.85);
      // A mão palheta sobre o corpo, logo abaixo de onde o braço começa.
      return [{ objeto: noEncaixe(posicionar(guitarra, 0, 0.06, 0)), osso: "maos" }];
    }
    case "keytar": {
      // Deitado no eixo do braço (+Y), com as teclas para a frente: a mão direita fica no meio das teclas.
      const teclado = parte(new THREE.BoxGeometry(0.75, 0.16, 0.05), cores.primaria);
      teclado.add(posicionar(parte(new THREE.BoxGeometry(0.55, 0.06, 0.012), MARFIM, false), 0.05, 0, 0.03));
      return [{ objeto: noEncaixe(posicionar(teclado, 0, 0.15, 0, 0, 0, -Math.PI / 2)), osso: "maos" }];
    }
    case "bateria":
      return (["rightHand", "leftHand"] as const).map((osso) => ({
        objeto: posicionar(parte(new THREE.CylinderGeometry(0.008, 0.012, 0.4, 6), MADEIRA), 0, -0.05, 0.12, Math.PI / 2),
        osso,
      }));
    case "vocal": {
      const microfone = new THREE.Group();
      microfone.add(parte(new THREE.CylinderGeometry(0.018, 0.012, 0.16, 10), PRETO));
      microfone.add(posicionar(parte(new THREE.SphereGeometry(0.03, 12, 10), "#b9b6b0"), 0, 0.09, 0));
      return [{ objeto: posicionar(microfone, 0, -0.06, 0.03), osso: "rightHand" }];
    }
  }
}
