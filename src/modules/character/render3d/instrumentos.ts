import * as THREE from "three";
import { cores } from "@/shared/styles/tokens";
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

/** Guitarra em V, como a da logo. O baixo é a mesma forma com braço mais longo. */
function guitarraEmV(comprimentoDoBraco: number) {
  const forma = new THREE.Shape();
  forma.moveTo(0, 0);
  forma.lineTo(-0.2, -0.42);
  forma.lineTo(-0.11, -0.44);
  forma.lineTo(0, -0.2);
  forma.lineTo(0.11, -0.44);
  forma.lineTo(0.2, -0.42);
  forma.closePath();
  const g = new THREE.Group();
  g.add(parte(new THREE.ExtrudeGeometry(forma, { depth: 0.04, bevelEnabled: false }).translate(0, 0.08, -0.02), cores.primaria));
  g.add(posicionar(parte(new THREE.BoxGeometry(0.045, comprimentoDoBraco, 0.025).translate(0, comprimentoDoBraco / 2, 0), PRETO), 0, 0.02, 0.01));
  g.add(posicionar(parte(new THREE.BoxGeometry(0.07, 0.12, 0.025), cores.primaria), 0.015, comprimentoDoBraco + 0.07, 0.01, 0, 0, -0.3));
  return g;
}

export function criarInstrumento(instrumento: Instrumento): Montado[] {
  switch (instrumento) {
    case "guitarra":
    case "baixo": {
      const guitarra = guitarraEmV(instrumento === "baixo" ? 0.72 : 0.55);
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
