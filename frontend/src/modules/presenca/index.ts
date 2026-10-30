import { adiar } from "@/shared/lib/adiar";
export { presenca, presencaDisponivel, transmitirPartida, usePresenca, useSouDaModeracao } from "./presenca";
export type { EstadoOnline, PessoaOnline } from "./protocolo";
export const TelaDeEspectador = adiar(() => import("./TelaDeEspectador").then((m) => m.TelaDeEspectador));
export type { PreferenciasOnline } from "./TelaOnline";
export const TelaOnline = adiar(() => import("./TelaOnline").then((m) => m.TelaOnline));
export { ChatGlobal } from "./ChatGlobal";
