import { adiar } from "@/shared/lib/adiar";
export const TelaDoMania = adiar(() => import("./TelaDoMania").then((m) => m.TelaDoMania));
export { IDENTIDADE_DO_MANIA } from "./identidade";
export { abrirBibliotecaDoMania, importarOsz, type BibliotecaDoMania, type ConjuntoSalvo, type OrigemDoConjunto } from "./beatmaps/biblioteca";
export { ErroDoOsz } from "./beatmaps/osz";
export { faixaDasEstrelas, type FaixaDeDificuldade } from "./beatmaps/dificuldades";
