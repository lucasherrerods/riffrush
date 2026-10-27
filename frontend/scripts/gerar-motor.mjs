// Recompila os motores da partida para WASM: o do Rock (backend/motor) e o do Mania (backend/motor-mania).
// `npm run motor` gera os dois; `npm run motor -- mania` gera só um.
// Os caminhos da máquina (pasta do cargo e do repositório) iriam para dentro do .wasm, que fica commitado:
// o --remap-path-prefix troca por nomes neutros.
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";

const raiz = resolve(import.meta.dirname, "../..");
const cargo = process.env.CARGO_HOME ?? resolve(homedir(), ".cargo");
const ambiente = { ...process.env, RUSTFLAGS: `--remap-path-prefix=${cargo}=/cargo --remap-path-prefix=${raiz}=/riffrush` };

const MOTORES = {
  rock: { crate: "backend/motor/wasm", wasm: "riffrush_motor_wasm.wasm", destino: "src/modules/rock/gameplay/wasm" },
  mania: { crate: "backend/motor-mania/wasm", wasm: "riffrush_motor_mania_wasm.wasm", destino: "src/modules/mania/gameplay/wasm" },
};

const pedidos = process.argv.slice(2);
for (const [nome, { crate, wasm, destino }] of Object.entries(MOTORES)) {
  if (pedidos.length && !pedidos.includes(nome)) continue;
  const pasta = resolve(raiz, crate);
  execFileSync("cargo", ["build", "--release", "--target", "wasm32-unknown-unknown", "--manifest-path", resolve(pasta, "Cargo.toml")], { stdio: "inherit", env: ambiente });
  execFileSync(
    "wasm-bindgen",
    ["--target", "web", "--weak-refs", "--out-dir", destino, "--out-name", "motor", resolve(pasta, "target/wasm32-unknown-unknown/release", wasm)],
    { stdio: "inherit", cwd: resolve(raiz, "frontend") },
  );
}
