import type { Modo } from "@/shared/modo";
import type { ApiDasPlaylists } from "./api";
import {
  adicionarOuTirar,
  alternarPublica,
  apagarPlaylist,
  carregarPlaylists,
  criarPlaylist,
  MAXIMO_DE_PLAYLISTS,
  salvarPlaylists,
  type Faixa,
  type Playlist,
} from "./playlists";

/** Onde cada modo guarda as playlists neste aparelho. */
export const CHAVE_DAS_PLAYLISTS: Record<Modo, string> = { rock: "riffrush:playlists", mania: "riffrush:mania:playlists" };

interface Dependencias {
  api: Pick<ApiDasPlaylists, "minhas" | "guardar" | "apagar">;
  /** A sessão da conta; sem ela as playlists ficam só no aparelho. */
  token: () => string | null;
  avisarErro: (mensagem: string) => void;
  novoId?: () => string;
}

/**
 * As playlists de um modo. Ficam no aparelho e, com a conta logada, na API, que é a fonte da verdade:
 * a primeira vez que este aparelho sincroniza, as que só existiam aqui sobem para a conta.
 */
export class LojaDePlaylists {
  private lista: Playlist[];
  private ouvintes = new Set<() => void>();
  private sincronizadaCom: string | null = null;

  constructor(
    private modo: Modo,
    private dependencias: Dependencias,
  ) {
    this.lista = carregarPlaylists(this.chave);
  }

  private get chave() {
    return CHAVE_DAS_PLAYLISTS[this.modo];
  }

  private get chaveDaPrimeiraSubida() {
    return `${this.chave}:subiram`;
  }

  estado = () => this.lista;

  inscrever = (ouvinte: () => void) => {
    this.ouvintes.add(ouvinte);
    void this.sincronizar();
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  };

  private trocar(lista: Playlist[]) {
    this.lista = lista;
    salvarPlaylists(this.chave, lista);
    this.ouvintes.forEach((ouvir) => ouvir());
  }

  /** Busca as da conta, uma vez por sessão. */
  async sincronizar(forcar = false) {
    const token = this.dependencias.token();
    if (!token || (!forcar && this.sincronizadaCom === token)) return;
    this.sincronizadaCom = token;
    try {
      const daConta = (await this.dependencias.api.minhas(token)).filter((p) => p.modo === this.modo);
      // Voltar depois de uma recusa não é a primeira subida: o que a API recusou não sobe de novo.
      const nuncaSubiram = !forcar && !localStorage.getItem(this.chaveDaPrimeiraSubida);
      const soAqui = nuncaSubiram ? this.lista.filter((p) => !daConta.some((d) => d.id === p.id)) : [];
      this.trocar([...daConta.map(({ id, nome, publica, faixas }) => ({ id, nome, publica, faixas })), ...soAqui]);
      for (const playlist of soAqui) await this.subir(playlist, token);
      localStorage.setItem(this.chaveDaPrimeiraSubida, "1");
    } catch {
      // Sem internet ou API fora: continua com as do aparelho e tenta de novo na próxima sessão.
      this.sincronizadaCom = null;
    }
  }

  private async subir(playlist: Playlist, token: string) {
    await this.dependencias.api.guardar(token, playlist.id, { nome: playlist.nome, modo: this.modo, publica: playlist.publica, faixas: playlist.faixas });
  }

  /** Muda aqui na hora e manda para a conta; se a API recusar, avisa e volta para o que está lá. */
  private mudar(lista: Playlist[], enviar: (token: string) => Promise<unknown>) {
    this.trocar(lista);
    const token = this.dependencias.token();
    if (!token) return;
    enviar(token).catch((erro: unknown) => {
      this.dependencias.avisarErro(erro instanceof Error ? erro.message : "Não deu para salvar a playlist na sua conta.");
      void this.sincronizar(true);
    });
  }

  private enviarA(id: string) {
    return (token: string) => {
      const playlist = this.lista.find((p) => p.id === id);
      return playlist ? this.subir(playlist, token) : Promise.resolve();
    };
  }

  /** Cria (já com as faixas, se vierem) e devolve o id da nova, ou nada quando o modo já tem o máximo. */
  criar = (nome: string, faixas: Faixa[] = []): string | null => {
    if (this.lista.length >= MAXIMO_DE_PLAYLISTS) {
      this.dependencias.avisarErro(`Dá para ter até ${MAXIMO_DE_PLAYLISTS} playlists.`);
      return null;
    }
    const nova = criarPlaylist(this.lista, nome, this.dependencias.novoId);
    const id = nova[nova.length - 1].id;
    this.mudar(
      nova.map((p) => (p.id === id ? { ...p, faixas } : p)),
      this.enviarA(id),
    );
    return id;
  };

  alternar = (id: string, faixa: Faixa) => this.mudar(adicionarOuTirar(this.lista, id, faixa), this.enviarA(id));

  alternarPublica = (id: string) => this.mudar(alternarPublica(this.lista, id), this.enviarA(id));

  apagar = (id: string) => this.mudar(apagarPlaylist(this.lista, id), (token) => this.dependencias.api.apagar(token, id));

  /** Guarda entre as suas uma cópia da playlist de um amigo, com id novo. */
  copiar = (playlist: Pick<Playlist, "nome" | "faixas">): boolean => this.criar(playlist.nome, playlist.faixas) !== null;
}
