import * as THREE from "three";
import { MIXAMO_PARA_VRM, retargetMixamo } from "./retarget";

/** Esqueleto Mixamo mínimo, em repouso sem rotação, com o quadril a 1 m do chão. */
function esqueletoMixamo() {
  const raiz = new THREE.Group();
  const quadril = new THREE.Bone();
  quadril.name = "mixamorigHips";
  quadril.position.y = 1;
  const coluna = new THREE.Bone();
  coluna.name = "mixamorigSpine";
  quadril.add(coluna);
  raiz.add(quadril);
  raiz.updateMatrixWorld(true);
  return raiz;
}

const nomeNoVRM = (osso: string) => `vrm_${osso}`;

describe("MIXAMO_PARA_VRM", () => {
  it("cobre os ossos humanoides principais", () => {
    for (const osso of ["hips", "spine", "chest", "neck", "head", "leftUpperArm", "rightHand", "leftUpperLeg", "rightFoot"]) {
      expect(Object.values(MIXAMO_PARA_VRM)).toContain(osso);
    }
  });
});

describe("retargetMixamo", () => {
  const clipe = new THREE.AnimationClip("tocar", 1, [
    new THREE.QuaternionKeyframeTrack("mixamorigSpine.quaternion", [0, 1], [0, 0, 0, 1, 0, 0.7071, 0, 0.7071]),
    new THREE.VectorKeyframeTrack("mixamorigHips.position", [0, 1], [0, 1, 0, 0, 1.2, 0]),
    new THREE.VectorKeyframeTrack("mixamorigSpine.position", [0, 1], [0, 0.1, 0, 0, 0.1, 0]),
    new THREE.QuaternionKeyframeTrack("mixamorigHeadTop_End.quaternion", [0], [0, 0, 0, 1]),
  ]);

  it("renomeia as trilhas para os ossos do VRM e descarta ossos sem equivalente", () => {
    const resultado = retargetMixamo(clipe, esqueletoMixamo(), { nomeNoVRM, alturaDoQuadril: 1, vrm0: false });
    expect(resultado.tracks.map((t) => t.name).sort()).toEqual(["vrm_hips.position", "vrm_spine.quaternion"]);
  });

  it("com repouso sem rotação mantém as rotações", () => {
    const resultado = retargetMixamo(clipe, esqueletoMixamo(), { nomeNoVRM, alturaDoQuadril: 1, vrm0: false });
    const rotacao = resultado.tracks.find((t) => t.name === "vrm_spine.quaternion")!;
    expect(Array.from(rotacao.values).map((v) => Number(v.toFixed(4)))).toEqual([0, 0, 0, 1, 0, 0.7071, 0, 0.7071]);
  });

  it("escala o movimento do quadril pela altura do personagem", () => {
    const resultado = retargetMixamo(clipe, esqueletoMixamo(), { nomeNoVRM, alturaDoQuadril: 0.8, vrm0: false });
    const posicao = resultado.tracks.find((t) => t.name === "vrm_hips.position")!;
    expect(posicao.values[1]).toBeCloseTo(0.8);
    expect(posicao.values[4]).toBeCloseTo(0.96);
  });

  it("compensa o repouso rotacionado do esqueleto Mixamo", () => {
    const esqueleto = esqueletoMixamo();
    const coluna = esqueleto.getObjectByName("mixamorigSpine")!;
    coluna.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.3);
    esqueleto.updateMatrixWorld(true);
    // Na pose de repouso, o osso do VRM não deve girar.
    const parado = new THREE.AnimationClip("parado", 0, [new THREE.QuaternionKeyframeTrack("mixamorigSpine.quaternion", [0], coluna.quaternion.toArray())]);
    const resultado = retargetMixamo(parado, esqueleto, { nomeNoVRM, alturaDoQuadril: 1, vrm0: false });
    const [x, y, z, w] = resultado.tracks[0].values;
    expect([x, y, z].map(Math.abs).every((v) => v < 1e-6)).toBe(true);
    expect(Math.abs(w)).toBeCloseTo(1);
  });

  it("espelha os eixos para modelos VRM 0.x, que olham para o outro lado", () => {
    const resultado = retargetMixamo(clipe, esqueletoMixamo(), { nomeNoVRM, alturaDoQuadril: 1, vrm0: true });
    const rotacao = resultado.tracks.find((t) => t.name === "vrm_spine.quaternion")!;
    expect(rotacao.values[5]).toBeCloseTo(0.7071);
    expect(rotacao.values[4]).toBeCloseTo(-0);
    const posicao = resultado.tracks.find((t) => t.name === "vrm_hips.position")!;
    expect(posicao.values[1]).toBeCloseTo(1);
  });
});
