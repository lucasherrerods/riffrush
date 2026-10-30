import { adiar } from "@/shared/lib/adiar";
export const TelaDeMultijogador = adiar(() => import("./TelaDeMultijogador").then((m) => m.TelaDeMultijogador));
export { Adversarios } from "./componentes/Adversarios";
export { Placar } from "./componentes/Placar";
export { resolverMusica } from "./musicaNaRede";
export type { PersonagemNaSala } from "./protocolo";
export { URL_DO_RELAY, podeTocarOnline } from "./online";
export { ehClienteWebDaSala, enviarEstado, escolher as escolherNaSala, lerConexao, sairDaSala, useConexao, voltarParaASala } from "./sala";
