import { sessaoDaConta } from "@/modules/conta";
import { presenca } from "@/modules/presenca";
import { avisar } from "@/shared/ui/avisos";
import { LojaDeConversas } from "./lojaDeConversas";
import { apiDosAmigos } from "./api";
import { ListaDeAmigos } from "./lista";

/** As listas da conta logada, uma só para o app. */
export const listaDeAmigos = new ListaDeAmigos(apiDosAmigos, () => sessaoDaConta.token());

/** As conversas com os amigos, uma só para o app. */
export const conversas = new LojaDeConversas({
  api: apiDosAmigos,
  token: () => sessaoDaConta.token(),
  meuId: () => sessaoDaConta.estado().conta?.id,
  ouvirPrivadas: presenca.ouvirPrivadas,
  avisarErro: (mensagem) => avisar.error(mensagem),
});
