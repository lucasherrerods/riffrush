// Prepara uma release do desktop na máquina de quem lança:
//   npm run lancar -- 0.2.0
// Sobe a versão nos três arquivos, gera o instalador NSIS e o copia para
// release/RiffRush-setup.exe, o nome fixo para onde o botão da landing aponta.
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const NOME_DO_INSTALADOR = "RiffRush-setup.exe";

export const versaoValida = (versao) => /^\d+\.\d+\.\d+$/.test(versao);

export const trocarVersaoNoJson = (texto, versao) => texto.replace(/("version":\s*")[^"]+(")/, `$1${versao}$2`);

// Só a primeira linha `version = ...`, que é a do [package].
export const trocarVersaoNoCargo = (texto, versao) => texto.replace(/^version = "[^"]+"/m, `version = "${versao}"`);

function lancar(versao) {
  if (!versaoValida(versao)) throw new Error("Use: npm run lancar -- 0.2.0");
  const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
  const trocar = (arquivo, troca) => writeFileSync(join(raiz, arquivo), troca(readFileSync(join(raiz, arquivo), "utf8"), versao));
  trocar("package.json", trocarVersaoNoJson);
  trocar("src-tauri/tauri.conf.json", trocarVersaoNoJson);
  trocar("src-tauri/Cargo.toml", trocarVersaoNoCargo);

  execSync("npm run tauri build", { cwd: raiz, stdio: "inherit" });

  const gerado = join(raiz, `src-tauri/target/release/bundle/nsis/Riff Rush_${versao}_x64-setup.exe`);
  mkdirSync(join(raiz, "release"), { recursive: true });
  copyFileSync(gerado, join(raiz, "release", NOME_DO_INSTALADOR));
  console.log(`\nPronto. Commite a versão e publique:\n  gh release create v${versao} release/${NOME_DO_INSTALADOR} --title "Riff Rush ${versao}" --notes "..."`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) lancar(process.argv[2]);
