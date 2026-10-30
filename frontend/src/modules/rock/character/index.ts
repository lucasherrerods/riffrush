import { adiar } from "@/shared/lib/adiar";
export { Avatar } from "./Avatar";
export const TelaDePersonagem = adiar(() => import("./TelaDePersonagem").then((m) => m.TelaDePersonagem));
export { PERSONAGEM_PADRAO, carregarPersonagem, migrarPersonagem, salvarPersonagem, type Personagem } from "./personagem";
export type { Ator, EstadoDoAvatar } from "./render3d/ator";
export { suportaWebGL } from "./render3d/webgl";
/** O 3D (three.js) é pesado: só baixa quando um palco aparece. */
export const carregarAtor = () => import("./render3d/ator").then((m) => m.criarAtor);
export { novaReacao, reacaoDoFimDaPartida, type Reacao, type TipoDeReacao } from "./reacao";
