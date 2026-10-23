import * as THREE from "three";

const euler = new THREE.Euler();
const rotacao = new THREE.Quaternion();

/**
 * Soma pequenas rotações (respiração, cabeça no ritmo) por cima da pose da animação, sem acumular.
 * O mixer do three.js só reescreve um osso quando o valor da animação muda; com a pose parada,
 * o ajuste do quadro anterior ficaria lá e o novo seria somado por cima. Por isso, antes de cada
 * quadro, `desfazer` devolve os ossos à pose de antes do ajuste.
 */
export function criarAjustador() {
  const poses = new Map<THREE.Object3D, THREE.Quaternion>();
  return {
    desfazer() {
      for (const [no, pose] of poses) no.quaternion.copy(pose);
      poses.clear();
    },
    aplicar(no: THREE.Object3D, [x, y, z]: [number, number, number]) {
      poses.set(no, no.quaternion.clone());
      no.quaternion.multiply(rotacao.setFromEuler(euler.set(x, y, z)));
    },
  };
}
