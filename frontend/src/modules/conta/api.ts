import type { Dificuldade, Instrumento } from "@/modules/songs";
import { ErroDaApi, criarCliente } from "@/shared/lib/api";

/** Os formatos que a API devolve, em snake_case como no JSON. */
export interface NivelDaConta {
  nivel: number;
  xp_no_nivel: number;
  xp_para_o_proximo: number;
}

export interface ContaDaApi {
  id: string;
  nome: string;
  avatar: string | null;
  /** Contas antigas só ganham o e-mail no próximo login. */
  email: string | null;
  xp_total: number;
  nivel: NivelDaConta;
}

export interface XpDaPartida {
  xp_ganho: number;
  antes: NivelDaConta;
  depois: NivelDaConta;
}

/** Partida de música do Encore: o XP entra na conta quando o servidor terminar de conferir o replay. */
export interface PartidaNaFila {
  pendente: true;
  id: string;
}

/** O servidor rejulgou a partida e ela não valeu (replay de outro chart, chart sumiu do Encore). */
export interface PartidaRecusada {
  recusada: true;
}

export type RegistroDaPartida = XpDaPartida | PartidaNaFila | PartidaRecusada;

/** O que `GET /partidas/{id}/xp` devolve enquanto a partida não tem XP. */
interface PartidaSemXp {
  pendente: boolean;
  recusada: boolean;
}

export interface PartidaParaAApi {
  musica_id: string;
  dificuldade: string;
  instrumento: string;
  pontos: number;
  acertos: number;
  total: number;
  derrota: boolean;
  fantasma: boolean;
  maior_sequencia: number;
  /** Soma do valor de cada acerto pelo julgamento (300, 100 ou 50), para o perfil ter a precisão do jogo. */
  valor_dos_acertos?: number;
  /** As entradas da partida comprimidas, em base64. */
  replay?: string;
}

export interface DificuldadeDoPerfil {
  dificuldade: Dificuldade;
  partidas: number;
  derrotas: number;
  /** De 0 a 1. */
  precisao: number;
  melhor_pontuacao: number;
}

export interface PartidaDoPerfil {
  musica_id: string;
  dificuldade: Dificuldade;
  pontos: number;
  acertos: number;
  total: number;
  /** De 0 a 1, a mesma do jogo. */
  precisao: number;
  derrota: boolean;
  jogada_em: string;
  /** Do catálogo da API. Sem eles, vale o nome da biblioteca. */
  titulo?: string | null;
  artista?: string | null;
  capa?: string | null;
}

export interface InstrumentoDoPerfil {
  instrumento: Instrumento;
  partidas: number;
}

export interface MusicaDoPerfil {
  musica_id: string;
  partidas: number;
  titulo?: string | null;
  artista?: string | null;
  capa?: string | null;
}

/** A melhor partida terminada de uma música, dificuldade e instrumento. */
export interface RecordeDaConta {
  musica_id: string;
  dificuldade: Dificuldade;
  instrumento: Instrumento;
  pontos: number;
  acertos: number;
  total: number;
  precisao: number | null;
}

export interface PerfilDaApi {
  nome: string;
  avatar: string | null;
  email: string | null;
  xp_total: number;
  nivel: NivelDaConta;
  criada_em: string;
  partidas: number;
  derrotas: number;
  /** De 0 a 1, contando todas as notas. */
  precisao: number;
  melhor_pontuacao: number;
  musicas_distintas: number;
  /** Sempre as quatro, da mais fácil para a mais difícil. */
  por_dificuldade: DificuldadeDoPerfil[];
  /** Só os instrumentos jogados, do mais jogado para o menos. */
  por_instrumento: InstrumentoDoPerfil[];
  /** Até três, da mais tocada para a menos. */
  mais_tocadas: MusicaDoPerfil[];
  /** As últimas partidas, da mais nova para a mais velha. */
  recentes: PartidaDoPerfil[];
}

/** O Google tem um client id para a web e outro para o desktop (que aceita qualquer porta no loopback). */
export type ClienteDoGoogle = "web" | "desktop";

export { ErroDaApi };

export function criarApi(base: string, buscar?: typeof fetch) {
  const chamar = criarCliente(base, buscar);
  return {
    entrar: (codigo: string, verificador: string, redirect_uri: string, cliente: ClienteDoGoogle) =>
      chamar<{ token: string; conta: ContaDaApi }>("POST", "/auth/google", { corpo: { codigo, verificador, redirect_uri, cliente } }),
    eu: (token: string) => chamar<ContaDaApi>("GET", "/eu", { token }),
    perfil: (token: string, sinal?: AbortSignal) => chamar<PerfilDaApi>("GET", "/eu/perfil", { token, sinal }),
    recordes: (token: string) => chamar<RecordeDaConta[]>("GET", "/eu/recordes", { token }),
    sair: (token: string) => chamar<void>("POST", "/auth/sair", { token }),
    excluirConta: (token: string) => chamar<void>("DELETE", "/eu", { token }),
    registrarPartida: (token: string, partida: PartidaParaAApi) => chamar<XpDaPartida | PartidaNaFila>("POST", "/partidas", { token, corpo: partida }),
    situacaoDaPartida: (token: string, id: string) => chamar<XpDaPartida | PartidaSemXp>("GET", `/partidas/${encodeURIComponent(id)}/xp`, { token }),
  };
}

export type ApiDaConta = ReturnType<typeof criarApi>;
