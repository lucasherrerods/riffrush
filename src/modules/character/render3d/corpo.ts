import * as THREE from "three";
import type { Montagem } from "../montagem";
import type { Pose } from "../pose";
import { escurecer, parte } from "./materiais";
import { acessorio, barba, cabelo, instrumento, roupaDoTronco } from "./pecas";

/**
 * Esqueleto procedural: grupos aninhados que fazem o papel dos ossos.
 * Quando houver modelos .glb finais, estes nomes viram os ossos do rig e o resto continua igual.
 */
export interface Esqueleto {
  raiz: THREE.Group;
  tronco: THREE.Group;
  cabeca: THREE.Group;
  ombroDireito: THREE.Group;
  cotoveloDireito: THREE.Group;
  ombroEsquerdo: THREE.Group;
  cotoveloEsquerdo: THREE.Group;
}

const SOLA = "#2b211b";

function membro(raio: number, comprimento: number, cor: string) {
  return parte(new THREE.CapsuleGeometry(raio, comprimento, 6, 12).translate(0, -comprimento / 2, 0), cor);
}

function grupo(x: number, y: number, z: number, ...filhos: THREE.Object3D[]) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (filhos.length) g.add(...filhos);
  return g;
}

/** Perfil do tronco em V, do quadril aos ombros, girado em torno do eixo vertical. */
function geometriaDoTronco({ medidas: m }: Montagem, folga = 1) {
  const perfil = [
    [m.quadril * 0.98, 0],
    [m.quadril * 0.92, m.tronco * 0.35],
    [m.ombros * 0.86, m.tronco * 0.72],
    [m.ombros * 0.82, m.tronco * 0.9],
    [m.cabeca * 0.24, m.tronco],
  ].map(([x, y]) => new THREE.Vector2(x * folga, y));
  return new THREE.LatheGeometry(perfil, 20).scale(1, 1, 0.58);
}

function cabecaCompleta(montagem: Montagem) {
  const { medidas: m, rosto, cores } = montagem;
  const r = m.cabeca / 2;
  const cabeca = new THREE.Group();

  const cranio = parte(new THREE.SphereGeometry(r, 24, 18).scale(0.86, 1, 0.94), cores.pele);
  const mandibula = parte(new THREE.SphereGeometry(r * 0.8, 20, 14).scale(0.86 * rosto.mandibula, 0.85, 0.95), cores.pele, false);
  mandibula.position.set(0, -r * 0.32, r * 0.08);
  const nariz = parte(new THREE.ConeGeometry(r * 0.1, r * 0.28, 8).rotateX(Math.PI / 2), escurecer(cores.pele, 0.05), false);
  nariz.position.set(0, -r * 0.12, r * 0.9);
  const boca = parte(new THREE.BoxGeometry(r * 0.32, r * 0.04, r * 0.04), escurecer(cores.pele, 0.45), false);
  boca.position.set(0, -r * 0.45, r * 0.8);
  cabeca.add(cranio, mandibula, nariz, boca);

  for (const lado of [-1, 1]) {
    const orelha = parte(new THREE.SphereGeometry(r * 0.18, 10, 8).scale(0.5, 1, 0.8), cores.pele);
    orelha.position.set(lado * r * 0.86, -r * 0.05, 0);

    // Olhos amendoados e expressivos, mas sem o exagero do chibi.
    const olho = new THREE.Group();
    olho.position.set(lado * r * 0.3, r * 0.06, r * 0.88);
    olho.scale.setScalar(rosto.olhos);
    const branco = parte(new THREE.SphereGeometry(r * 0.15, 14, 10).scale(1.25, 0.8, 0.4), "#efe9df", false);
    const iris = parte(new THREE.SphereGeometry(r * 0.09, 12, 10).scale(1, 1, 0.4), cores.olhos, false);
    iris.position.z = r * 0.04;
    const pupila = parte(new THREE.SphereGeometry(r * 0.045, 10, 8).scale(1, 1, 0.4), "#120d0b", false);
    pupila.position.z = r * 0.07;
    olho.add(branco, iris, pupila);

    const sobrancelha = parte(new THREE.BoxGeometry(r * 0.38, r * 0.06 * rosto.sobrancelhas, r * 0.08), cores.cabelo, false);
    sobrancelha.position.set(lado * r * 0.3, r * 0.3, r * 0.93);
    sobrancelha.rotation.z = lado * -0.12;
    cabeca.add(orelha, olho, sobrancelha);
  }

  cabeca.add(cabelo(montagem));
  const daBarba = barba(montagem);
  if (daBarba) cabeca.add(daBarba);
  const doAcessorio = acessorio(montagem);
  if (doAcessorio) cabeca.add(doAcessorio);
  return cabeca;
}

/** Monta o personagem inteiro, com os pés na origem e olhando para +z. */
export function construirCorpo(montagem: Montagem): Esqueleto {
  const { medidas: m, cores, pecas } = montagem;
  const raiz = new THREE.Group();
  const calca = escurecer(cores.roupa, 0.35);
  const mangaLonga = pecas.roupa === "jaqueta" || pecas.roupa === "sobretudo";
  const corDoBraco = mangaLonga ? cores.roupa : pecas.roupa === "camiseta" ? cores.roupa : cores.pele;

  for (const lado of [-1, 1]) {
    const coxa = grupo(lado * m.quadril * 0.5, m.perna, 0, membro(m.espessura * 1.25, m.perna * 0.48, calca));
    const canela = grupo(0, -m.perna * 0.5, 0, membro(m.espessura, m.perna * 0.44, calca));
    const bota = parte(new THREE.BoxGeometry(m.espessura * 2.2, m.espessura * 1.8, m.espessura * 4).translate(0, 0, m.espessura), SOLA);
    bota.position.y = -m.perna * 0.47;
    canela.add(bota);
    coxa.add(canela);
    raiz.add(coxa);
  }

  const tronco = grupo(0, m.perna, 0);
  tronco.add(parte(geometriaDoTronco(montagem), cores.pele, false));
  tronco.add(roupaDoTronco(montagem, parte(geometriaDoTronco(montagem, 1.06), cores.roupa)));
  const pescoco = membro(m.cabeca * 0.2, m.pescoco, cores.pele);
  pescoco.position.y = m.tronco + m.pescoco;
  const cabeca = grupo(0, m.tronco + m.pescoco + m.cabeca * 0.45, 0, cabecaCompleta(montagem));
  tronco.add(pescoco, cabeca);

  const bracos = [-1, 1].map((lado) => {
    const ombro = grupo(lado * m.ombros * 0.92, m.tronco * 0.86, 0, membro(m.espessura * 1.05, m.braco * 0.44, corDoBraco));
    // A camiseta tem manga curta: o antebraço fica de fora.
    const corDoAntebraco = mangaLonga ? cores.roupa : cores.pele;
    const mao = parte(new THREE.SphereGeometry(m.espessura * 1.1, 10, 8).scale(0.8, 1.2, 0.6), cores.pele);
    mao.position.y = -m.braco * 0.44;
    const cotovelo = grupo(0, -m.braco * 0.46, 0, membro(m.espessura * 0.9, m.braco * 0.42, corDoAntebraco), mao);
    ombro.add(cotovelo);
    tronco.add(ombro);
    return { ombro, cotovelo };
  });

  raiz.add(tronco);
  const esqueleto: Esqueleto = {
    raiz,
    tronco,
    cabeca,
    ombroEsquerdo: bracos[0].ombro,
    cotoveloEsquerdo: bracos[0].cotovelo,
    ombroDireito: bracos[1].ombro,
    cotoveloDireito: bracos[1].cotovelo,
  };
  tronco.add(instrumento(montagem, esqueleto));
  return esqueleto;
}

/** Posições de base dos braços para cada instrumento; a pose anima por cima delas. */
export function aplicarPose(esqueleto: Esqueleto, montagem: Montagem, pose: Pose) {
  const { tronco, cabeca, ombroDireito, cotoveloDireito, ombroEsquerdo, cotoveloEsquerdo, raiz } = esqueleto;
  tronco.rotation.x = pose.tronco;
  tronco.scale.y = 1 + pose.respiracao;
  cabeca.rotation.x = pose.cabeca;
  raiz.rotation.z = pose.balanco * 0.3;

  switch (montagem.pecas.instrumento) {
    case "vocal":
      ombroDireito.rotation.set(-1.1, 0, 0.35);
      cotoveloDireito.rotation.set(-1.9 + pose.palhetada * 0.15, 0, 0);
      ombroEsquerdo.rotation.set(0.1, 0, -0.15 - pose.palhetada * 0.6);
      cotoveloEsquerdo.rotation.set(-0.2, 0, 0);
      break;
    case "bateria":
      ombroDireito.rotation.set(-0.7 - pose.palhetada * 0.4, 0, 0.25);
      cotoveloDireito.rotation.set(-0.9 + pose.palhetada * 0.5, 0, 0);
      ombroEsquerdo.rotation.set(-0.7 - (1 - pose.palhetada) * 0.2, 0, -0.25);
      cotoveloEsquerdo.rotation.set(-0.9, 0, 0);
      break;
    default:
      // Mão direita palhetando no corpo do instrumento, esquerda no braço dele.
      ombroDireito.rotation.set(-0.35, 0, 0.3);
      cotoveloDireito.rotation.set(-1.25 + pose.palhetada * 0.45, 0, -0.2);
      ombroEsquerdo.rotation.set(-0.75, 0, -0.45);
      cotoveloEsquerdo.rotation.set(-1.0, 0.4, 0);
  }
}
