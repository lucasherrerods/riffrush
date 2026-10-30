import { adiar } from "@/shared/lib/adiar";
export type { RegistroDaPartida, XpDaPartida } from "./api";
export { CartaoDaConta } from "./CartaoDaConta";
export { ExcluirConta } from "./ExcluirConta";
export { GanhoDeXp } from "./GanhoDeXp";
export const TelaDePerfil = adiar(() => import("./TelaDePerfil").then((m) => m.TelaDePerfil));
export { contasLigadas, sessaoDaConta } from "./sessao";
export { useConta } from "./useConta";
