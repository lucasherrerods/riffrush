import { adiar } from "@/shared/lib/adiar";
/** Baixa a tela do Mania antes de ela aparecer, por exemplo no começo da troca de modo. */
export const carregarTelaDoMania = () => import("./TelaDoMania").then((m) => m.TelaDoMania);
export const TelaDoMania = adiar(carregarTelaDoMania);
export { IDENTIDADE_DO_MANIA } from "./identidade";
export { abrirBibliotecaDoMania, importarOsz, type BibliotecaDoMania, type ConjuntoSalvo, type OrigemDoConjunto } from "./beatmaps/biblioteca";
export { ErroDoOsz } from "./beatmaps/osz";
export { faixaDasEstrelas, type FaixaDeDificuldade } from "./beatmaps/dificuldades";
export { FundoDoMania } from "./menu/FundoDoMania";
