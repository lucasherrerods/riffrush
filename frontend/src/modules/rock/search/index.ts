import { adiar } from "@/shared/lib/adiar";
export const TelaDeBuscaDeMusicas = adiar(() => import("./TelaDeBuscaDeMusicas").then((m) => m.TelaDeBuscaDeMusicas));
export { JanelaDoChart } from "./JanelaDoChart";
export type { OpcoesDeBaixar } from "./useBaixarDoEncore";
export { baixarDoEncore, baixarSng } from "./download";
export { linkDoChartConfere, montarUrlDoChart } from "./encore";
export type { ResultadoDaBusca } from "./encore";
export { sortearChartOficial } from "./encore";
