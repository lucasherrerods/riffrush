import * as THREE from "three";
import type { Montagem } from "../montagem";
import type { Esqueleto } from "./corpo";
import { escurecer, parte } from "./materiais";

/**
 * Peças trocáveis desenhadas com formas simples, provisórias até os modelos .glb finais.
 * Cada função recebe a montagem e devolve um grupo pronto para prender no osso certo.
 */

const PRETO = "#16110f";
const METAL = "#b9b6b0";

function posicionar<T extends THREE.Object3D>(objeto: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
  objeto.position.set(x, y, z);
  objeto.rotation.set(rx, ry, rz);
  return objeto;
}

/** Mecha em ponta, o desenho de cabelo do estilo Toriyama. */
function mecha(r: number, cor: string, comprimento: number, x: number, y: number, z: number, rx: number, rz: number) {
  return posicionar(parte(new THREE.ConeGeometry(r * 0.22, r * comprimento, 5).translate(0, (r * comprimento) / 2, 0), cor), x, y, z, rx, 0, rz);
}

/** Calota do cabelo inclinada para trás: linha do cabelo alta na testa e nuca coberta. */
function touca(r: number, cor: string, folga = 1.06, abertura = 0.42) {
  return parte(new THREE.SphereGeometry(r * folga, 24, 14, 0, Math.PI * 2, 0, Math.PI * abertura).rotateX(-0.5).scale(0.88, 1, 0.98), cor);
}

export function cabelo({ medidas, pecas, cores }: Montagem) {
  const r = medidas.cabeca / 2;
  const c = cores.cabelo;
  const g = new THREE.Group();
  switch (pecas.cabelo) {
    case "rebelde":
      g.add(touca(r, c));
      for (let i = 0; i < 7; i++) {
        const angulo = -1.1 + i * 0.37;
        g.add(mecha(r, c, 0.9 + (i % 2) * 0.3, Math.sin(angulo) * r * 0.55, r * 0.55, -Math.cos(angulo) * r * 0.3, -0.7, -angulo * 0.6));
      }
      for (let i = 0; i < 3; i++) g.add(mecha(r, c, 0.55, (i - 1) * r * 0.35, r * 0.62, r * 0.55, 2.2, (i - 1) * 0.4));
      break;
    case "curto":
      g.add(touca(r, c));
      for (let i = 0; i < 4; i++) g.add(mecha(r, c, 0.4, (i - 1.5) * r * 0.3, r * 0.65, r * 0.45, 2.0, (i - 1.5) * 0.3));
      break;
    case "longo":
      g.add(touca(r, c));
      g.add(posicionar(parte(new THREE.CapsuleGeometry(r * 0.75, r * 1.3, 6, 14).scale(1.15, 1, 0.55), c), 0, -r * 0.55, -r * 0.4, 0.15));
      for (const lado of [-1, 1]) g.add(posicionar(parte(new THREE.CapsuleGeometry(r * 0.2, r * 1.1, 4, 8), c), lado * r * 0.78, -r * 0.45, r * 0.15));
      break;
    case "moicano":
      g.add(touca(r, escurecer(c, 0.5), 1.01));
      for (let i = 0; i < 6; i++) {
        const angulo = -0.9 + i * 0.4;
        g.add(mecha(r, c, 0.8, 0, Math.cos(angulo) * r * 0.85, Math.sin(angulo) * r * 0.85, angulo, 0));
      }
      break;
    case "rabo":
      g.add(touca(r, c));
      g.add(posicionar(parte(new THREE.TorusGeometry(r * 0.16, r * 0.05, 6, 12), cores.detalhe), 0, r * 0.15, -r * 0.92, 0.3));
      g.add(posicionar(parte(new THREE.ConeGeometry(r * 0.28, r * 1.6, 8).translate(0, -r * 0.8, 0), c), 0, r * 0.12, -r * 1.0, 0.35));
      break;
    case "raspado":
      g.add(touca(r, escurecer(c, 0.3), 1.01, 0.45));
      break;
  }
  return g;
}

export function barba({ medidas, pecas, cores, rosto }: Montagem) {
  if (!pecas.barba) return null;
  const r = medidas.cabeca / 2;
  if (pecas.barba === "cavanhaque") {
    return posicionar(parte(new THREE.ConeGeometry(r * 0.2, r * 0.4, 8).rotateX(Math.PI), cores.cabelo), 0, -r * 0.82, r * 0.62, 0.25);
  }
  const cheia = parte(new THREE.SphereGeometry(r * 0.82, 20, 12, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55).scale(0.9 * rosto.mandibula, 1, 1), cores.cabelo);
  return posicionar(cheia, 0, -r * 0.3, r * 0.12);
}

export function acessorio({ medidas, pecas, cores }: Montagem) {
  if (!pecas.acessorio) return null;
  const r = medidas.cabeca / 2;
  const g = new THREE.Group();
  switch (pecas.acessorio) {
    case "oculos":
      for (const lado of [-1, 1]) g.add(posicionar(parte(new THREE.BoxGeometry(r * 0.42, r * 0.22, r * 0.05), PRETO), lado * r * 0.34, r * 0.08, r * 0.9));
      g.add(posicionar(parte(new THREE.BoxGeometry(r * 0.2, r * 0.04, r * 0.04), PRETO, false), 0, r * 0.12, r * 0.92));
      break;
    case "fone":
      g.add(posicionar(parte(new THREE.TorusGeometry(r * 0.98, r * 0.06, 8, 24, Math.PI), PRETO), 0, r * 0.05, 0));
      for (const lado of [-1, 1]) {
        g.add(posicionar(parte(new THREE.CylinderGeometry(r * 0.28, r * 0.28, r * 0.18, 16).rotateZ(Math.PI / 2), cores.detalhe), lado * r * 0.92, 0, 0));
      }
      break;
    case "bandana":
      g.add(posicionar(parte(new THREE.TorusGeometry(r * 0.92, r * 0.09, 8, 28).scale(0.92, 1, 1), cores.detalhe), 0, r * 0.42, 0, Math.PI / 2 - 0.25));
      g.add(posicionar(parte(new THREE.ConeGeometry(r * 0.14, r * 0.6, 6), cores.detalhe), r * 0.15, r * 0.25, -r * 1.0, -2.2));
      break;
  }
  return g;
}

/** Roupa por cima do tronco: a camada base já veio pronta; aqui entram gola, zíper, cinto e aba do sobretudo. */
export function roupaDoTronco({ medidas: m, pecas, cores }: Montagem, camada: THREE.Mesh) {
  const g = new THREE.Group();
  g.add(camada);
  const cinto = posicionar(parte(new THREE.TorusGeometry(m.quadril * 1.0, m.espessura * 0.35, 6, 24).scale(1, 0.58, 1), escurecer(cores.roupa, 0.55)), 0, m.tronco * 0.04, 0, Math.PI / 2);
  const fivela = posicionar(parte(new THREE.BoxGeometry(m.espessura * 1.4, m.espessura * 1.0, m.espessura * 0.4), cores.detalhe, false), 0, m.tronco * 0.04, m.quadril * 0.6);
  g.add(cinto, fivela);

  if (pecas.roupa === "jaqueta" || pecas.roupa === "sobretudo") {
    const gola = parte(new THREE.TorusGeometry(m.cabeca * 0.3, m.espessura * 0.55, 6, 18).scale(1, 0.7, 1), cores.roupa);
    g.add(posicionar(gola, 0, m.tronco * 0.94, 0, Math.PI / 2 - 0.2));
    g.add(posicionar(parte(new THREE.BoxGeometry(m.espessura * 0.35, m.tronco * 0.8, m.espessura * 0.3), cores.detalhe, false), 0, m.tronco * 0.45, m.quadril * 0.62));
  }
  if (pecas.roupa === "sobretudo") {
    const aba = parte(new THREE.CylinderGeometry(m.quadril * 1.08, m.quadril * 1.35, m.perna * 0.6, 20).scale(1, 1, 0.65).translate(0, -m.perna * 0.3, 0), cores.roupa);
    g.add(aba);
  }
  if (pecas.roupa === "colete") {
    for (const lado of [-1, 1]) {
      g.add(posicionar(parte(new THREE.BoxGeometry(m.espessura * 0.5, m.tronco * 0.6, m.espessura * 0.3), cores.detalhe, false), lado * m.quadril * 0.3, m.tronco * 0.55, m.quadril * 0.66, 0, 0, lado * 0.15));
    }
  }
  return g;
}

/** Guitarra em V, como a da logo. O baixo é a mesma forma com braço mais longo. */
function guitarraEmV(escala: number, cor: string, comprimentoDoBraco: number) {
  const forma = new THREE.Shape();
  forma.moveTo(0, 0);
  forma.lineTo(-0.2, -0.42);
  forma.lineTo(-0.11, -0.44);
  forma.lineTo(0, -0.2);
  forma.lineTo(0.11, -0.44);
  forma.lineTo(0.2, -0.42);
  forma.closePath();
  const g = new THREE.Group();
  g.add(parte(new THREE.ExtrudeGeometry(forma, { depth: 0.04, bevelEnabled: false }).translate(0, 0.08, -0.02), cor));
  g.add(posicionar(parte(new THREE.BoxGeometry(0.045, comprimentoDoBraco, 0.025).translate(0, comprimentoDoBraco / 2, 0), PRETO), 0, 0.02, 0.01));
  g.add(posicionar(parte(new THREE.BoxGeometry(0.07, 0.12, 0.025), cor), 0.015, comprimentoDoBraco + 0.07, 0.01, 0, 0, -0.3));
  g.scale.setScalar(escala);
  return g;
}

export function instrumento(montagem: Montagem, esqueleto: Esqueleto) {
  const { medidas: m, pecas, cores } = montagem;
  const escala = m.altura / 1.75;
  const g = new THREE.Group();
  switch (pecas.instrumento) {
    case "guitarra":
    case "baixo": {
      const corpo = guitarraEmV(escala, cores.detalhe, pecas.instrumento === "baixo" ? 0.72 : 0.55);
      g.add(posicionar(corpo, m.quadril * 0.15, m.tronco * 0.28, m.quadril * 0.85, -0.15, 0, 1.15));
      break;
    }
    case "keytar": {
      const teclado = parte(new THREE.BoxGeometry(0.75 * escala, 0.16 * escala, 0.05 * escala), cores.detalhe);
      teclado.add(posicionar(parte(new THREE.BoxGeometry(0.55 * escala, 0.06 * escala, 0.012 * escala), "#e8e4dc", false), 0.05 * escala, 0, 0.03 * escala));
      g.add(posicionar(teclado, 0, m.tronco * 0.35, m.quadril * 0.95, -0.2, 0, 0.35));
      break;
    }
    case "bateria": {
      const caixa = parte(new THREE.CylinderGeometry(0.18 * escala, 0.18 * escala, 0.14 * escala, 24), cores.detalhe);
      caixa.add(posicionar(parte(new THREE.CylinderGeometry(0.175 * escala, 0.175 * escala, 0.005, 24), "#e8e4dc", false), 0, 0.07 * escala, 0));
      g.add(posicionar(caixa, 0, -m.tronco * 0.05, m.quadril * 2.4, 0.25));
      for (const cotovelo of [esqueleto.cotoveloDireito, esqueleto.cotoveloEsquerdo]) {
        cotovelo.add(posicionar(parte(new THREE.CylinderGeometry(0.008, 0.012, 0.4 * escala, 6), "#d9b98a"), 0, -m.braco * 0.46, 0.15 * escala, Math.PI / 2));
      }
      break;
    }
    case "vocal": {
      const microfone = new THREE.Group();
      microfone.add(parte(new THREE.CylinderGeometry(0.018, 0.012, 0.16 * escala, 10), PRETO));
      microfone.add(posicionar(parte(new THREE.SphereGeometry(0.03 * escala, 12, 10), METAL), 0, 0.09 * escala, 0));
      esqueleto.cotoveloDireito.add(posicionar(microfone, 0, -m.braco * 0.48, 0.02, -0.4));
      break;
    }
  }
  return g;
}
