// Converte animações da Mixamo (FBX) em GLB leves, só com o esqueleto e as curvas.
// Uso: node scripts/preparar-animacoes.mjs <pasta com .fbx>
// Cada arquivo vira public/modelos/animacoes/<nome>.glb. Requer os pacotes fbx2gltf e @gltf-transform/*.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { dedup, prune, resample } from "@gltf-transform/functions";

const pasta = resolve(process.argv[2] ?? "assets-fonte/mixamo/animacoes");
const destino = resolve("public/modelos/animacoes");
const temporaria = join(tmpdir(), "riffrush-animacoes");
const conversor = resolve(`node_modules/fbx2gltf/bin/${process.platform === "win32" ? "Windows_NT/FBX2glTF.exe" : process.platform === "darwin" ? "Darwin/FBX2glTF" : "Linux/FBX2glTF"}`);
mkdirSync(destino, { recursive: true });
mkdirSync(temporaria, { recursive: true });

const io = new NodeIO();
for (const arquivo of readdirSync(pasta).filter((nome) => nome.toLowerCase().endsWith(".fbx"))) {
  const nome = basename(arquivo, ".fbx");
  const glb = join(temporaria, nome);
  execFileSync(conversor, ["--binary", "--input", join(pasta, arquivo), "--output", glb], { stdio: "ignore" });

  const documento = await io.read(`${glb}.glb`);
  const raiz = documento.getRoot();
  // O personagem que vem junto da animação não é usado: o jogo aplica a animação no VRM.
  for (const no of raiz.listNodes()) {
    no.setMesh(null);
    no.setSkin(null);
  }
  for (const item of [...raiz.listMeshes(), ...raiz.listSkins(), ...raiz.listMaterials(), ...raiz.listTextures()]) item.dispose();
  raiz.listAnimations().forEach((animacao) => animacao.setName(nome));
  await documento.transform(resample(), dedup(), prune({ keepLeaves: true }));
  await io.write(join(destino, `${nome}.glb`), documento);
  console.log(`${nome}.glb`);
}
rmSync(temporaria, { recursive: true, force: true });
