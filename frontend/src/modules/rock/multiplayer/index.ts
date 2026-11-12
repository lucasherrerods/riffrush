import { adiar } from "@/shared/lib/adiar";
export const TelaDeMultijogador = adiar(() => import("./TelaDeMultijogador").then((m) => m.TelaDeMultijogador));
export { Adversarios } from "./componentes/Adversarios";
export { PlacarDaSala as Placar } from "./componentes/PlacarDaSala";
export { resolverMusica } from "./musicaNaRede";
export type { PersonagemNaSala } from "./protocolo";
export { podeTocarOnline } from "./musicaNaRede";
export { ehClienteWebDaSala, entrarNaSalaOnline, enviarEstado, escolher as escolherNaSala, lerConexao, sairDaSala, useConexao, voltarParaASala } from "./sala";
