import * as THREE from "three";
import { criarInstrumento, encaixarNasMaos } from "./instrumentos";

const FRENTE = new THREE.Vector3(0, 0, 1);
const eixoDoBraco = (objeto: THREE.Object3D) => new THREE.Vector3(0, 1, 0).applyQuaternion(objeto.quaternion);
const face = (objeto: THREE.Object3D) => new THREE.Vector3(0, 0, 1).applyQuaternion(objeto.quaternion);

describe("encaixarNasMaos", () => {
  // Bug: a guitarra ficava presa à coluna numa pose fixa, longe das mãos da animação, e atravessava o rosto.
  it("o braço do instrumento aponta da mão que palheta para a mão dos acordes", () => {
    const guitarra = new THREE.Group();
    const palheta = new THREE.Vector3(-0.07, 1, 0.22);
    const acordes = new THREE.Vector3(0.13, 1.07, 0.45);
    encaixarNasMaos(guitarra, palheta, acordes, FRENTE);
    const esperado = acordes.clone().sub(palheta).normalize();
    expect(eixoDoBraco(guitarra).angleTo(esperado)).toBeLessThan(0.01);
  });

  it("o corpo do instrumento fica junto da mão que palheta", () => {
    const guitarra = new THREE.Group();
    const palheta = new THREE.Vector3(-0.25, 0.85, 0.06);
    encaixarNasMaos(guitarra, palheta, new THREE.Vector3(0.23, 0.87, 0.11), FRENTE);
    expect(guitarra.position.distanceTo(palheta)).toBeLessThan(0.1);
  });

  it("a frente do instrumento fica virada para a frente do personagem", () => {
    const guitarra = new THREE.Group();
    encaixarNasMaos(guitarra, new THREE.Vector3(-0.2, 1, 0.1), new THREE.Vector3(0.2, 1.1, 0.2), FRENTE);
    expect(face(guitarra).dot(FRENTE)).toBeGreaterThan(0.5);
    expect(face(guitarra).dot(eixoDoBraco(guitarra))).toBeCloseTo(0);
  });

  it("nunca entra no corpo, mesmo com a mão colada no peito", () => {
    const guitarra = new THREE.Group();
    const tronco = new THREE.Vector3(0, 1, 0);
    encaixarNasMaos(guitarra, new THREE.Vector3(-0.1, 1, 0.05), new THREE.Vector3(0.2, 1.05, 0.1), FRENTE, tronco);
    const distanciaParaAFrente = guitarra.position.clone().sub(tronco).dot(face(guitarra));
    expect(distanciaParaAFrente).toBeGreaterThanOrEqual(0.12);
  });

  it("com as mãos juntas, usa um ângulo de braço padrão em vez de sumir", () => {
    const guitarra = new THREE.Group();
    const mao = new THREE.Vector3(0, 1, 0.2);
    encaixarNasMaos(guitarra, mao, mao.clone(), FRENTE);
    expect(Number.isNaN(guitarra.quaternion.x)).toBe(false);
    // O braço sobe para a esquerda do personagem (+x).
    expect(eixoDoBraco(guitarra).x).toBeGreaterThan(0);
    expect(eixoDoBraco(guitarra).y).toBeGreaterThan(0);
  });
});

describe("criarInstrumento", () => {
  it("guitarra, baixo e keytar são levados pelas mãos; baquetas e microfone ficam presos à mão", () => {
    for (const instrumento of ["guitarra", "baixo", "keytar"] as const) expect(criarInstrumento(instrumento)[0].osso).toBe("maos");
    expect(criarInstrumento("bateria").map((m) => m.osso)).toEqual(["rightHand", "leftHand"]);
    expect(criarInstrumento("vocal")[0].osso).toBe("rightHand");
  });
});
