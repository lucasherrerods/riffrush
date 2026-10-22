import * as THREE from "three";
import { aplicarCores, vestirPeca } from "./vrm";

function malha(nomeDoMaterial: string) {
  const material = new THREE.MeshBasicMaterial({ color: "#808080" });
  material.name = nomeDoMaterial;
  return new THREE.Mesh(new THREE.BufferGeometry(), material);
}

describe("aplicarCores", () => {
  it("pinta só os materiais da parte escolhida", () => {
    const cena = new THREE.Group();
    const cabelo = malha("Hair_00_HAIR");
    const pele = malha("Body_00_SKIN");
    cena.add(cabelo, pele);
    aplicarCores(cena, { cabelo: "#ff0000", pele: null, olhos: null, roupa: null, calca: null, calcados: null });
    expect((cabelo.material as THREE.MeshBasicMaterial).color.getHexString()).toBe("ff0000");
    expect((pele.material as THREE.MeshBasicMaterial).color.getHexString()).toBe("808080");
  });

  it("volta à cor original quando a escolha é removida", () => {
    const cena = new THREE.Group();
    const cabelo = malha("Hair_00_HAIR");
    cena.add(cabelo);
    const semCor = { cabelo: null, pele: null, olhos: null, roupa: null, calca: null, calcados: null };
    aplicarCores(cena, { ...semCor, cabelo: "#00ff00" });
    aplicarCores(cena, semCor);
    expect((cabelo.material as THREE.MeshBasicMaterial).color.getHexString()).toBe("808080");
  });
});

describe("vestirPeca", () => {
  function esqueletoComOssos(...nomes: string[]) {
    const ossos = nomes.map((nome) => Object.assign(new THREE.Bone(), { name: nome }));
    for (let i = 1; i < ossos.length; i++) ossos[i - 1].add(ossos[i]);
    return ossos;
  }

  function pecaPresaA(...nomes: string[]) {
    const ossos = esqueletoComOssos(...nomes);
    const geometria = new THREE.BufferGeometry();
    const roupa = new THREE.SkinnedMesh(geometria, malha("Jaqueta_CLOTH").material);
    roupa.add(ossos[0]);
    roupa.bind(new THREE.Skeleton(ossos));
    const peca = new THREE.Group();
    peca.add(roupa);
    return { peca, roupa };
  }

  it("religa a malha da peça aos ossos do corpo pelo nome", () => {
    const corpo = new THREE.Group();
    const ossosDoCorpo = esqueletoComOssos("J_Bip_C_Hips", "J_Bip_C_Spine");
    corpo.add(ossosDoCorpo[0]);
    const { peca, roupa } = pecaPresaA("J_Bip_C_Hips", "J_Bip_C_Spine");

    vestirPeca(corpo, peca, []);
    expect(roupa.skeleton.bones).toEqual(ossosDoCorpo);
    expect(roupa.parent).toBe(corpo);
  });

  it("esconde as partes do corpo que a peça cobre", () => {
    const corpo = new THREE.Group();
    const camiseta = malha("Tops_01_CLOTH");
    const pele = malha("Body_00_SKIN");
    corpo.add(camiseta, pele, esqueletoComOssos("J_Bip_C_Hips")[0]);
    vestirPeca(corpo, pecaPresaA("J_Bip_C_Hips").peca, ["roupa"]);
    expect((camiseta.material as THREE.Material).visible).toBe(false);
    expect((pele.material as THREE.Material).visible).toBe(true);
  });
});
