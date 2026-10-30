import { sessaoDaConta } from "@/modules/conta";
import { apiDosAmigos } from "./api";
import { ListaDeAmigos } from "./lista";

/** As listas da conta logada, uma só para o app. */
export const listaDeAmigos = new ListaDeAmigos(apiDosAmigos, () => sessaoDaConta.token());
