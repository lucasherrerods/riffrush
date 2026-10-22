import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from "@pixiv/three-vrm";
import { categoriaDoMaterial, escalasDoCorpo, fatorDeTinta } from "../aparencia";
import { arquivoDaAnimacao, type ParteColorivel } from "../catalogo";
import type { Personagem } from "../personagem";
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

export async function carregarPeca(url: string): Promise<THREE.Object3D> {
  const gltf: GLTF = await carregador().parseAsync(await baixar(url), "");
  return gltf.scene;
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

interface MaterialComCor extends THREE.Material {
  color: THREE.Color;
  map?: THREE.Texture | null;
  shadeColorFactor?: THREE.Color;
}

const materiaisDe = (malha: THREE.Mesh) => (Array.isArray(malha.material) ? malha.material : [malha.material]) as MaterialComCor[];

/** Cor média de uma textura, em espaço linear, lida numa miniatura de 16 × 16. */
function mediaDaTextura(textura: THREE.Texture): [number, number, number] | null {
  const imagem = textura.image as CanvasImageSource | undefined;
  if (!imagem || typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  const contexto = canvas.getContext("2d", { willReadFrequently: true });
  if (!contexto) return null;
  contexto.drawImage(imagem, 0, 0, 16, 16);
  const { data } = contexto.getImageData(0, 0, 16, 16);
  const soma = new THREE.Color(0, 0, 0);
  const pixel = new THREE.Color();
  let pixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    soma.add(pixel.setRGB(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255, THREE.SRGBColorSpace));
    pixels++;
  }
  return pixels ? [soma.r / pixels, soma.g / pixels, soma.b / pixels] : null;
}

/** Pinta os materiais de cada parte. Com textura, mantém o desenho dela e só troca a cor média. */
export function aplicarCores(cena: THREE.Object3D, cores: Personagem["cores"]) {
  cena.traverse((objeto) => {
    if (!(objeto instanceof THREE.Mesh)) return;
    for (const material of materiaisDe(objeto)) {
      const parte = categoriaDoMaterial(material.name);
      if (!parte || !material.color) continue;
      const original = (material.userData.corOriginal ??= {
        cor: material.color.clone(),
        sombra: material.shadeColorFactor?.clone(),
        media: material.map ? mediaDaTextura(material.map) : null,
      }) as { cor: THREE.Color; sombra?: THREE.Color; media: [number, number, number] | null };
      const escolhida = cores[parte];
      if (!escolhida) {
        material.color.copy(original.cor);
        if (original.sombra) material.shadeColorFactor?.copy(original.sombra);
        continue;
      }
      const alvo = new THREE.Color(escolhida);
      const fator = original.media ? new THREE.Color(...fatorDeTinta(original.media, [alvo.r, alvo.g, alvo.b])) : alvo;
      material.color.copy(fator);
      if (original.sombra) material.shadeColorFactor?.copy(original.sombra).multiply(fator);
    }
  });
}

/** Altura e proporções pelo tamanho do modelo inteiro e pela escala dos ossos do esqueleto original. */
export function aplicarCorpo(vrm: VRM, corpo: Personagem["corpo"]) {
  const { altura, ossos } = escalasDoCorpo(corpo);
  vrm.scene.scale.setScalar(altura);
  for (const [osso, [x, y, z]] of Object.entries(ossos)) vrm.humanoid.getRawBoneNode(osso as VRMHumanBoneName)?.scale.set(x, y, z);
}

/**
 * Veste uma peça (roupa, cabelo, acessório) feita para o esqueleto humanoide:
 * a malha passa a seguir os ossos do corpo com o mesmo nome, como no "merge armature" do VRChat.
 */
export function vestirPeca(corpo: THREE.Object3D, peca: THREE.Object3D, cobre: ParteColorivel[]) {
  const malhas: THREE.SkinnedMesh[] = [];
  peca.traverse((objeto) => {
    if (objeto instanceof THREE.SkinnedMesh) malhas.push(objeto);
  });
  for (const malha of malhas) {
    const ossos = malha.skeleton.bones.map((osso) => (corpo.getObjectByName(osso.name) as THREE.Bone | undefined) ?? osso);
    corpo.add(malha);
    malha.bind(new THREE.Skeleton(ossos, malha.skeleton.boneInverses), malha.bindMatrix);
    malha.frustumCulled = false;
  }
  corpo.traverse((objeto) => {
    if (!(objeto instanceof THREE.Mesh) || malhas.includes(objeto as THREE.SkinnedMesh)) return;
    for (const material of materiaisDe(objeto)) {
      const parte = categoriaDoMaterial(material.name);
      if (parte && cobre.includes(parte)) material.visible = false;
    }
  });
}
