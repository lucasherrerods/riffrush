import type { MensagemPrivada } from "@/modules/presenca";
import type { ApiDosAmigos } from "./api";
import { definirNaoLidas, juntarHistorico, lerConversa, marcarComoLida, receberPrivada, type Conversas } from "./conversas";

export interface DependenciasDasConversas {
  api: Pick<ApiDosAmigos, "mensagens" | "enviarMensagem" | "marcarLidas" | "naoLidas">;
  token: () => string | null;
  meuId: () => string | undefined;
  /** As mensagens que o relay entrega na hora. */
  ouvirPrivadas: (ouvinte: (mensagem: MensagemPrivada) => void) => () => void;
  avisarErro: (mensagem: string) => void;
}

/**
 * As conversas com os amigos, uma loja só para o app. As mensagens ficam na API;
 * aqui fica o que já foi carregado. Começa a ouvir o relay no primeiro uso.
 */
export class LojaDeConversas {
  private atual: Conversas = {};
  private ouvintes = new Set<() => void>();
  private ouvindo = false;

  constructor(private deps: DependenciasDasConversas) {}

  inscrever = (ouvinte: () => void) => {
    this.ouvir();
    this.ouvintes.add(ouvinte);
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  };

  estado = () => this.atual;

  /** Busca o histórico só na primeira vez que a conversa abre. */
  async carregar(amigo: string) {
    const token = this.deps.token();
    if (!token || lerConversa(this.atual, amigo).carregada) return;
    try {
      this.mudar(juntarHistorico(this.atual, amigo, await this.deps.api.mensagens(token, amigo)));
    } catch (erro) {
      this.deps.avisarErro((erro as Error).message);
    }
  }

  async carregarNaoLidas() {
    const token = this.deps.token();
    if (!token) return;
    try {
      this.mudar(definirNaoLidas(this.atual, await this.deps.api.naoLidas(token)));
    } catch {
      // O contador é só um aviso: na próxima busca ele volta.
    }
  }

  enviar = async (amigo: string, texto: string) => {
    const token = this.deps.token();
    if (!token) return;
    try {
      const mensagem = await this.deps.api.enviarMensagem(token, amigo, texto);
      this.mudar(juntarHistorico(this.atual, amigo, [mensagem]));
    } catch (erro) {
      this.deps.avisarErro((erro as Error).message);
    }
  };

  marcarComoLida = (amigo: string) => {
    const token = this.deps.token();
    this.mudar(marcarComoLida(this.atual, amigo));
    if (token) this.deps.api.marcarLidas(token, amigo).catch(() => {});
  };

  private ouvir() {
    if (this.ouvindo) return;
    this.ouvindo = true;
    this.deps.ouvirPrivadas((mensagem) => {
      const meuId = this.deps.meuId();
      if (meuId) this.mudar(receberPrivada(this.atual, mensagem, meuId));
    });
  }

  private mudar(conversas: Conversas) {
    if (conversas === this.atual) return;
    this.atual = conversas;
    for (const ouvinte of this.ouvintes) ouvinte();
  }
}
