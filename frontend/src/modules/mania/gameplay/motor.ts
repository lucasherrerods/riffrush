import iniciarWasm, { initSync } from "./wasm/motor";
import urlDoWasm from "./wasm/motor_bg.wasm?url";

export { InfoDoBeatmap, MotorDoMania, ReplayLido, hashDoBeatmap, modsValemRanking, multiplicadorDosMods, problemaDosMods, velocidadeDosMods } from "./wasm/motor";

let carregado: Promise<void> | null = null;

/** Carrega o motor do Mania só quando o modo abre: quem joga só o Rock nunca baixa este .wasm. */
export function iniciarMotorDoMania() {
  carregado ??= iniciarWasm({ module_or_path: urlDoWasm }).then(() => {});
  return carregado;
}

/** Para os testes, que já têm os bytes do .wasm na mão. */
export function iniciarMotorDoManiaComBytes(bytes: BufferSource) {
  initSync({ module: bytes });
  carregado = Promise.resolve();
}
