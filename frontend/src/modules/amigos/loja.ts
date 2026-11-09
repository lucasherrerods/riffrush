import { sessaoDaConta } from "@/modules/conta";
import { presenca } from "@/modules/presenca";
import { marcarComoLida, receberPrivada, type Conversas } from "./conversas";
import { apiDosAmigos } from "./api";
import { ListaDeAmigos } from "./lista";

/** As listas da conta logada, uma só para o app. */
export const listaDeAmigos = new ListaDeAmigos(apiDosAmigos, () => sessaoDaConta.token());

/**
 * As conversas privadas, uma loja só para o app. Começa a ouvir no primeiro uso,
 * para guardar as mensagens mesmo com o painel de amigos fechado.
 */
class LojaDeConversas {
  private atual: Conversas = {};
  private ouvintes = new Set<() => void>();
  private ouvindo = false;

  inscrever = (ouvinte: () => void) => {
    this.ouvir();
    this.ouvintes.add(ouvinte);
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  };

  estado = () => this.atual;

  enviar = (para: string, texto: string) => presenca.enviarPrivada(para, texto);

  marcarComoLida = (amigo: string) => this.mudar(marcarComoLida(this.atual, amigo));

  private ouvir() {
    if (this.ouvindo) return;
    this.ouvindo = true;
    presenca.ouvirPrivadas((mensagem) => {
      const amigos = new Set(listaDeAmigos.estado().listas?.amigos.map((a) => a.conta_id));
      this.mudar(receberPrivada(this.atual, mensagem, amigos));
    });
  }

  private mudar(conversas: Conversas) {
    if (conversas === this.atual) return;
    this.atual = conversas;
    for (const ouvinte of this.ouvintes) ouvinte();
  }
}

export const conversas = new LojaDeConversas();
