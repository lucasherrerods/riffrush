import { adiar } from "@/shared/lib/adiar";
export { PainelDeRanking } from "./PainelDeRanking";
export { RankingDaSelecao } from "./RankingDaSelecao";
export { PlacarAoVivo } from "./PlacarAoVivo";
export const TelaDeLeaderboard = adiar(() => import("./TelaDeLeaderboard").then((m) => m.TelaDeLeaderboard));
export const TelaDePartidaDoRanking = adiar(() => import("./TelaDePartidaDoRanking").then((m) => m.TelaDePartidaDoRanking));
export type { MusicaNoRanking } from "./api";
export { buscarMd5sMaisJogados } from "./maisJogadas";
