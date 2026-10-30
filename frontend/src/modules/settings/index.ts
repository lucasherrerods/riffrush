import { adiar } from "@/shared/lib/adiar";
export const TelaDeConfiguracoes = adiar(() => import("./TelaDeConfiguracoes").then((m) => m.TelaDeConfiguracoes));
export {
  CONFIGURACOES_PADRAO,
  INDICE_DA_PALHETA,
  antecedenciaDasNotas,
  VELOCIDADE_DAS_NOTAS,
  carregarConfiguracoes,
  nomeDaTecla,
  salvarConfiguracoes,
  type Configuracoes,
} from "./configuracoes";
