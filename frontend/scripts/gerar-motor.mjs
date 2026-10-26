// Recompila o motor da partida (backend/motor) para WASM em src/modules/gameplay/wasm.
// Os caminhos da máquina (pasta do cargo e do repositório) iriam para dentro do .wasm, que fica commitado:
// o --remap-path-prefix troca por nomes neutros.
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";

const raiz = resolve(import.meta.dirname, "../..");
const cargo = process.env.CARGO_HOME ?? resolve(homedir(), ".cargo");
const ambiente = { ...process.env, RUSTFLAGS: `--remap-path-prefix=${cargo}=/cargo --remap-path-prefix=${raiz}=/riffrush` };
const crate = resolve(raiz, "backend/motor/wasm");

execFileSync("cargo", ["build", "--release", "--target", "wasm32-unknown-unknown", "--manifest-path", resolve(crate, "Cargo.toml")], { stdio: "inherit", env: ambiente });
execFileSync(
  "wasm-bindgen",
  ["--target", "web", "--weak-refs", "--out-dir", "src/modules/gameplay/wasm", "--out-name", "motor", resolve(crate, "target/wasm32-unknown-unknown/release/riffrush_motor_wasm.wasm")],
  { stdio: "inherit", cwd: resolve(raiz, "frontend") },
);
