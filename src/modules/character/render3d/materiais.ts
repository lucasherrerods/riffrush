import * as THREE from "three";

/** Três faixas de luz com borda dura: sombra, meia-luz e luz. É o que dá o visual de cel-shading. */
function criarFaixasDeLuz() {
  const tons = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  const textura = new THREE.DataTexture(tons, 3, 1, THREE.RGBAFormat);
  textura.minFilter = THREE.NearestFilter;
  textura.magFilter = THREE.NearestFilter;
  textura.generateMipmaps = false;
  textura.needsUpdate = true;
  return textura;
}

let faixas: THREE.DataTexture | undefined;
const materiais = new Map<string, THREE.MeshToonMaterial>();

/** Material toon com luz de borda, que separa a silhueta do fundo escuro. Um por cor, compartilhado. */
export function materialToon(cor: string) {
  let material = materiais.get(cor);
  if (!material) {
    faixas ??= criarFaixasDeLuz();
    material = new THREE.MeshToonMaterial({ color: cor, gradientMap: faixas });
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
        float aro = 1.0 - max(dot(normalize(vViewPosition), normal), 0.0);
        gl_FragColor.rgb += smoothstep(0.66, 0.7, aro) * 0.12;`,
      );
    };
    materiais.set(cor, material);
  }
  return material;
}

/** Contorno por casco invertido: a malha empurrada pela normal, desenhada só por dentro e em cor escura. */
const materialDoContorno = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: { espessura: { value: 0.006 }, cor: { value: new THREE.Color("#120d0b") } },
  vertexShader: `
    uniform float espessura;
    void main() {
      vec4 posicao = modelViewMatrix * vec4(position, 1.0);
      vec3 normalNaVista = normalize(normalMatrix * normal);
      posicao.xyz += normalNaVista * espessura;
      gl_Position = projectionMatrix * posicao;
    }`,
  fragmentShader: `
    uniform vec3 cor;
    void main() { gl_FragColor = vec4(cor, 1.0); }`,
});

/** Malha com material toon e contorno. */
export function parte(geometria: THREE.BufferGeometry, cor: string, comContorno = true) {
  const malha = new THREE.Mesh(geometria, materialToon(cor));
  if (comContorno) malha.add(new THREE.Mesh(geometria, materialDoContorno));
  return malha;
}
