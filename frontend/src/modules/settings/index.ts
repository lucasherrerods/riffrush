import { adiar } from "@/shared/lib/adiar";
export const TelaDeConfiguracoes = adiar(() => import("./TelaDeConfiguracoes").then((m) => m.TelaDeConfiguracoes));
export {
  CONFIGURACOES_PADRAO,
  configuracoesPadrao,
  INDICE_DA_PALHETA,
  antecedenciaDasNotas,
  VELOCIDADE_DAS_NOTAS,
  carregarConfiguracoes,
  nomeDaTecla,
  salvarConfiguracoes,
  type Configuracoes,
} from "./configuracoes";
export { MolduraDeConfiguracoes, type AbaDeConfiguracoes } from "./componentes/MolduraDeConfiguracoes";
export { AbaDeAudio } from "./componentes/AbaDeAudio";
export { BotaoDeTecla } from "./componentes/BotaoDeTecla";
export { LinhaDeOpcao } from "./componentes/LinhaDeOpcao";
export { LinhaDeSlider } from "./componentes/LinhaDeSlider";
