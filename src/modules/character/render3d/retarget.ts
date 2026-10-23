import * as THREE from "three";

/** Ossos do esqueleto da Mixamo (nome já sem ":", como o GLTFLoader deixa) e seus equivalentes humanoides do VRM. */
export const MIXAMO_PARA_VRM: Record<string, string> = {
  mixamorigHips: "hips",
  mixamorigSpine: "spine",
  mixamorigSpine1: "chest",
  mixamorigSpine2: "upperChest",
  mixamorigNeck: "neck",
  mixamorigHead: "head",
  mixamorigLeftShoulder: "leftShoulder",
  mixamorigLeftArm: "leftUpperArm",
  mixamorigLeftForeArm: "leftLowerArm",
  mixamorigLeftHand: "leftHand",
  mixamorigLeftHandThumb1: "leftThumbMetacarpal",
  mixamorigLeftHandThumb2: "leftThumbProximal",
  mixamorigLeftHandThumb3: "leftThumbDistal",
  mixamorigLeftHandIndex1: "leftIndexProximal",
  mixamorigLeftHandIndex2: "leftIndexIntermediate",
  mixamorigLeftHandIndex3: "leftIndexDistal",
  mixamorigLeftHandMiddle1: "leftMiddleProximal",
  mixamorigLeftHandMiddle2: "leftMiddleIntermediate",
  mixamorigLeftHandMiddle3: "leftMiddleDistal",
  mixamorigLeftHandRing1: "leftRingProximal",
  mixamorigLeftHandRing2: "leftRingIntermediate",
  mixamorigLeftHandRing3: "leftRingDistal",
  mixamorigLeftHandPinky1: "leftLittleProximal",
  mixamorigLeftHandPinky2: "leftLittleIntermediate",
  mixamorigLeftHandPinky3: "leftLittleDistal",
  mixamorigRightShoulder: "rightShoulder",
  mixamorigRightArm: "rightUpperArm",
  mixamorigRightForeArm: "rightLowerArm",
  mixamorigRightHand: "rightHand",
  mixamorigRightHandThumb1: "rightThumbMetacarpal",
  mixamorigRightHandThumb2: "rightThumbProximal",
  mixamorigRightHandThumb3: "rightThumbDistal",
  mixamorigRightHandIndex1: "rightIndexProximal",
  mixamorigRightHandIndex2: "rightIndexIntermediate",
  mixamorigRightHandIndex3: "rightIndexDistal",
  mixamorigRightHandMiddle1: "rightMiddleProximal",
  mixamorigRightHandMiddle2: "rightMiddleIntermediate",
  mixamorigRightHandMiddle3: "rightMiddleDistal",
  mixamorigRightHandRing1: "rightRingProximal",
  mixamorigRightHandRing2: "rightRingIntermediate",
  mixamorigRightHandRing3: "rightRingDistal",
  mixamorigRightHandPinky1: "rightLittleProximal",
  mixamorigRightHandPinky2: "rightLittleIntermediate",
  mixamorigRightHandPinky3: "rightLittleDistal",
  mixamorigLeftUpLeg: "leftUpperLeg",
  mixamorigLeftLeg: "leftLowerLeg",
  mixamorigLeftFoot: "leftFoot",
  mixamorigLeftToeBase: "leftToes",
  mixamorigRightUpLeg: "rightUpperLeg",
  mixamorigRightLeg: "rightLowerLeg",
  mixamorigRightFoot: "rightFoot",
  mixamorigRightToeBase: "rightToes",
};

const giroVertical = new THREE.Quaternion();

/** Tira da rotação o giro em volta do eixo vertical (virar de lado), mantendo as inclinações. */
function semGiroNoEixoVertical(q: THREE.Quaternion) {
  giroVertical.set(0, q.y, 0, q.w);
  if (giroVertical.lengthSq() < 1e-12) return q;
  return q.multiply(giroVertical.normalize().invert());
}

interface Destino {
  /** Nome do nó normalizado do VRM para um osso humanoide, ou undefined se o modelo não tem esse osso. */
  nomeNoVRM: (osso: string) => string | undefined;
  /** Altura do quadril do VRM em repouso, em metros. */
  alturaDoQuadril: number;
  /** VRM 0.x olha para -z; os eixos x e z precisam ser espelhados. */
  vrm0: boolean;
}

/**
 * Converte uma animação da Mixamo para o esqueleto humanoide normalizado do VRM.
 * Cada rotação é levada do espaço de repouso da Mixamo para o espaço de mundo,
 * que é o espaço dos ossos normalizados do VRM. Baseado no exemplo oficial do three-vrm.
 */
export function retargetMixamo(clipe: THREE.AnimationClip, esqueletoMixamo: THREE.Object3D, { nomeNoVRM, alturaDoQuadril, vrm0 }: Destino) {
  esqueletoMixamo.updateMatrixWorld(true);
  const quadrilDaMixamo = esqueletoMixamo.getObjectByName("mixamorigHips")?.position.y || 1;
  const escalaDoQuadril = alturaDoQuadril / quadrilDaMixamo;
  const repousoInverso = new THREE.Quaternion();
  const repousoDoPai = new THREE.Quaternion();
  const q = new THREE.Quaternion();
  const trilhas: THREE.KeyframeTrack[] = [];

  for (const trilha of clipe.tracks) {
    const [ossoDaMixamo, propriedade] = trilha.name.split(".");
    const osso = MIXAMO_PARA_VRM[ossoDaMixamo];
    const nome = osso && nomeNoVRM(osso);
    const no = esqueletoMixamo.getObjectByName(ossoDaMixamo);
    if (!nome || !no) continue;

    if (trilha instanceof THREE.QuaternionKeyframeTrack) {
      no.getWorldQuaternion(repousoInverso).invert();
      if (no.parent) no.parent.getWorldQuaternion(repousoDoPai);
      else repousoDoPai.identity();
      const valores = Float32Array.from(trilha.values);
      for (let i = 0; i < valores.length; i += 4) {
        q.fromArray(valores, i).premultiply(repousoDoPai).multiply(repousoInverso);
        if (osso === "hips") semGiroNoEixoVertical(q);
        q.toArray(valores, i);
        if (vrm0) {
          valores[i] *= -1;
          valores[i + 2] *= -1;
        }
      }
      trilhas.push(new THREE.QuaternionKeyframeTrack(`${nome}.${propriedade}`, Array.from(trilha.times), Array.from(valores)));
    } else if (trilha instanceof THREE.VectorKeyframeTrack && osso === "hips" && propriedade === "position") {
      // Só o quadril se mexe, e só para cima e para baixo: o avatar fica no lugar, dentro do quadro.
      // Nos outros ossos a posição vem do próprio modelo.
      const valores = Array.from(trilha.values, (v, i) => (i % 3 === 1 ? v * escalaDoQuadril : 0));
      trilhas.push(new THREE.VectorKeyframeTrack(`${nome}.${propriedade}`, Array.from(trilha.times), valores));
    }
  }
  return new THREE.AnimationClip(clipe.name, clipe.duration, trilhas);
}
