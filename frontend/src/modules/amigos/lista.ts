import type { ApiDosAmigos, ListasDeAmigos, SugestaoDeAmizade } from "./api";

export interface EstadoDosAmigos {
  listas: ListasDeAmigos | null;
  sugestoes: SugestaoDeAmizade[] | null;
}

/** As listas da conta logada, uma só para o app: o botão do cabeçalho e o painel leem da mesma. */
export class ListaDeAmigos {
  private atual: EstadoDosAmigos = { listas: null, sugestoes: null };
  private ouvintes = new Set<() => void>();

  constructor(
    private api: ApiDosAmigos,
    private token: () => string | null,
  ) {}

  inscrever = (ouvinte: () => void) => {
    this.ouvintes.add(ouvinte);
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  };

  estado = () => this.atual;

  /** Sem sessão, esvazia. Falha de rede mantém o que já estava na tela. */
  async recarregar() {
    const token = this.token();
    if (!token) return this.mudar({ listas: null, sugestoes: null });
    const listas = await this.api.listas(token).catch(() => null);
    if (listas) this.mudar({ ...this.atual, listas });
  }

  async carregarSugestoes() {
    const token = this.token();
    if (!token) return;
    const sugestoes = await this.api.sugestoes(token).catch(() => null);
    if (sugestoes) this.mudar({ ...this.atual, sugestoes });
  }

  /** Uma ação na API seguida das listas atualizadas. O erro sobe para quem chamou avisar a pessoa. */
  async agir<T>(acao: (api: ApiDosAmigos, token: string) => Promise<T>): Promise<T> {
    const token = this.token();
    if (!token) throw new Error("Entre com a sua conta para ter amigos.");
    const resultado = await acao(this.api, token);
    await this.recarregar();
    if (this.atual.sugestoes) await this.carregarSugestoes();
    return resultado;
  }

  private mudar(estado: EstadoDosAmigos) {
    this.atual = estado;
    for (const ouvinte of this.ouvintes) ouvinte();
  }
}
