import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from "@pixiv/three-vrm";
import { arquivoDaAnimacao } from "../catalogo";
import { retargetMixamo } from "./retarget";

const arquivos = new Map<string, Promise<ArrayBuffer>>();

/** Cada arquivo é baixado uma vez só; vários avatares do mesmo modelo reaproveitam o download. */
function baixar(url: string) {
  let pedido = arquivos.get(url);
  if (!pedido) {
    pedido = fetch(url).then((resposta) => {
      if (!resposta.ok) throw new Error(`Não foi possível carregar ${url}`);
      return resposta.arrayBuffer();
    });
    pedido.catch(() => arquivos.delete(url));
    arquivos.set(url, pedido);
  }
  return pedido;
}

function carregador() {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  return loader;
}

export async function carregarVRM(url: string): Promise<VRM> {
  const gltf = await carregador().parseAsync(await baixar(url), "");
  const vrm = gltf.userData.vrm as VRM;
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.rotateVRM0(vrm);
  // Os ossos animados mudam a malha de lugar; o recorte pela caixa original cortaria braços e cabelo.
  vrm.scene.traverse((objeto) => (objeto.frustumCulled = false));
  return vrm;
}

const animacoes = new Map<string, Promise<{ clipe: THREE.AnimationClip; esqueleto: THREE.Object3D }>>();

/** Animação da Mixamo convertida para o VRM. O arquivo é carregado uma vez e convertido por modelo. */
export async function animacaoParaVRM(id: string, vrm: VRM) {
  let pedido = animacoes.get(id);
  if (!pedido) {
    pedido = baixar(arquivoDaAnimacao(id))
      .then((dados) => new GLTFLoader().parseAsync(dados, ""))
      .then((gltf) => ({ clipe: gltf.animations[0], esqueleto: gltf.scene }));
    animacoes.set(id, pedido);
  }
  const { clipe, esqueleto } = await pedido;
  const quadril = vrm.humanoid.getNormalizedBoneNode("hips")!;
  const alturaDoQuadril = Math.abs(quadril.getWorldPosition(new THREE.Vector3()).y - vrm.scene.getWorldPosition(new THREE.Vector3()).y);
  return retargetMixamo(clipe, esqueleto, {
    nomeNoVRM: (osso) => vrm.humanoid.getNormalizedBoneNode(osso as VRMHumanBoneName)?.name,
    alturaDoQuadril,
    vrm0: vrm.meta.metaVersion === "0",
  });
}
