import * as THREE from "three";
import { cores } from "@/shared/styles/tokens";
import type { Instrumento } from "../catalogo";
import { parte } from "./materiais";

/**
 * Instrumentos desenhados com formas simples, presos a um osso humanoide do VRM.
 * Medidas em metros, para um personagem de cerca de 1,6 m. As animações compartilhadas seguram nestas posições.
 */
export interface Montado {
  objeto: THREE.Object3D;
  osso: "spine" | "rightHand" | "leftHand";
}

const PRETO = "#16110f";
const MARFIM = "#e8e4dc";
const MADEIRA = "#d9b98a";

function posicionar<T extends THREE.Object3D>(objeto: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
  objeto.position.set(x, y, z);
  objeto.rotation.set(rx, ry, rz);
  return objeto;
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
      return [{ objeto: posicionar(guitarra, 0.02, 0.2, 0.16, 0.1, 0, -1.05), osso: "spine" }];
    }
    case "keytar": {
      const teclado = parte(new THREE.BoxGeometry(0.75, 0.16, 0.05), cores.primaria);
      teclado.add(posicionar(parte(new THREE.BoxGeometry(0.55, 0.06, 0.012), MARFIM, false), 0.05, 0, 0.03));
      return [{ objeto: posicionar(teclado, 0, 0.1, 0.2, -0.3, 0, -0.3), osso: "spine" }];
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
