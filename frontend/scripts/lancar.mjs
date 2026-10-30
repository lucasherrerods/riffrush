// Prepara uma release do desktop na máquina de quem lança:
//   npm run lancar -- 0.2.0
// Sobe a versão nos três arquivos, gera o instalador NSIS assinado para o updater e
// deixa em release/ o RiffRush-setup.exe (nome fixo para o botão da landing) e o latest.json.
// A chave privada vem de TAURI_SIGNING_PRIVATE_KEY (caminho ou conteúdo) ou de ~/.tauri/riffrush.key,
// e a senha dela de TAURI_SIGNING_PRIVATE_KEY_PASSWORD.
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const NOME_DO_INSTALADOR = "RiffRush-setup.exe";
const REPOSITORIO = "https://github.com/lucasherrerods/riffrush";

export const versaoValida = (versao) => /^\d+\.\d+\.\d+$/.test(versao);

export const trocarVersaoNoJson = (texto, versao) => texto.replace(/("version":\s*")[^"]+(")/, `$1${versao}$2`);

// Só a primeira linha `version = ...`, que é a do [package].
export const trocarVersaoNoCargo = (texto, versao) => texto.replace(/^version = "[^"]+"/m, `version = "${versao}"`);

/** O arquivo que o updater do app baixa de releases/latest para saber se há versão nova. */
export const montarLatestJson = (versao, assinatura, data) =>
  JSON.stringify(
    {
      version: versao,
      pub_date: data.toISOString(),
      platforms: {
        "windows-x86_64": { signature: assinatura, url: `${REPOSITORIO}/releases/download/v${versao}/${NOME_DO_INSTALADOR}` },
      },
    },
    null,
    2,
  );

function lancar(versao) {
  if (!versaoValida(versao)) throw new Error("Use: npm run lancar -- 0.2.0");
  const chavePadrao = join(homedir(), ".tauri", "riffrush.key");
  const chave = process.env.TAURI_SIGNING_PRIVATE_KEY ?? (existsSync(chavePadrao) ? chavePadrao : null);
  if (!chave) throw new Error("Sem a chave do updater: defina TAURI_SIGNING_PRIVATE_KEY ou crie ~/.tauri/riffrush.key");

  const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
  const trocar = (arquivo, troca) => writeFileSync(join(raiz, arquivo), troca(readFileSync(join(raiz, arquivo), "utf8"), versao));
  trocar("package.json", trocarVersaoNoJson);
  trocar("src-tauri/tauri.conf.json", trocarVersaoNoJson);
  trocar("src-tauri/Cargo.toml", trocarVersaoNoCargo);

  // Os artefatos do updater só no lançamento: o build de quem desenvolve não precisa da chave.
  const config = JSON.stringify({ bundle: { createUpdaterArtifacts: true } });
  execSync(`npm run tauri build -- --config ${JSON.stringify(config)}`, {
    cwd: raiz,
    stdio: "inherit",
    env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY: chave },
  });

  const gerado = join(raiz, `src-tauri/target/release/bundle/nsis/Riff Rush_${versao}_x64-setup.exe`);
  const destino = join(raiz, "release");
  mkdirSync(destino, { recursive: true });
  copyFileSync(gerado, join(destino, NOME_DO_INSTALADOR));
  writeFileSync(join(destino, "latest.json"), montarLatestJson(versao, readFileSync(`${gerado}.sig`, "utf8").trim(), new Date()));
  console.log(
    `\nPronto. Commite a versão e publique:\n  gh release create v${versao} release/${NOME_DO_INSTALADOR} release/latest.json --title "Riff Rush ${versao}" --notes "..."`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) lancar(process.argv[2]);
