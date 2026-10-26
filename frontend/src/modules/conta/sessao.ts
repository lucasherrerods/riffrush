import { valorDosAcertos, type Resultado } from "@/modules/gameplay";
import { invoke } from "@tauri-apps/api/core";
import { URL_DA_API } from "@/shared/lib/api";
import { ErroDaApi, criarApi, type ApiDaConta, type ClienteDoGoogle, type ContaDaApi, type RegistroDaPartida } from "./api";
import { desafioDoVerificador, gerarVerificador, lerRetornoDoGoogle, urlDoLoginDoGoogle } from "./pkce";

export interface EstadoDaConta {
  conta: ContaDaApi | null;
  /** Lendo a sessão guardada ou trocando o código do Google. */
  carregando: boolean;
}

interface Armazenamento {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

export interface Ambiente {
  api: ApiDaConta;
  clientId: string;
  /** Guarda o token entre aberturas do app. */
  local: Armazenamento;
  /** Guarda o verificador só durante a ida e volta ao Google. */
  temporario: Armazenamento;
  /** O endereço para onde o Google volta: a própria página. */
  redirectUri: () => string;
  /** No desktop: abre o navegador do sistema e devolve a volta do Google. */
  loginPeloNavegador?: (url: string) => Promise<{ busca: string; redirectUri: string }>;
  irPara: (url: string) => void;
  busca: () => string;
  limparBusca: () => void;
  /** Só no `npm run dev`: abre logado com esta conta, para ver as telas de quem tem conta sem passar pelo Google. */
  contaFalsa?: ContaDaApi;
}

const CHAVE_DO_TOKEN = "riffrush:token";
const CHAVE_DO_VERIFICADOR = "riffrush:pkce";
const CHAVE_DO_ESTADO = "riffrush:pkce-estado";

/** A conta de quem está jogando, num só lugar para o app inteiro. */
export class SessaoDaConta {
  private estadoAtual: EstadoDaConta = { conta: null, carregando: false };
  private ouvintes = new Set<() => void>();

  constructor(private ambiente: Ambiente) {}

  inscrever = (ouvinte: () => void) => {
    this.ouvintes.add(ouvinte);
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  };

  estado = () => this.estadoAtual;

  /** O token de quem está logado, para rotas que mostram algo a mais para a pessoa (o ranking). */
  token() {
    return this.estadoAtual.conta ? this.ambiente.local.getItem(CHAVE_DO_TOKEN) : null;
  }

  /** Na abertura: termina um login que voltou do Google ou retoma a sessão guardada. */
  async iniciar() {
    if (this.ambiente.contaFalsa) return this.mudar({ conta: this.ambiente.contaFalsa });
    const { temporario, local } = this.ambiente;
    const retorno = lerRetornoDoGoogle(this.ambiente.busca(), temporario.getItem(CHAVE_DO_ESTADO));
    if (retorno.tipo !== "nada") {
      this.ambiente.limparBusca();
      const verificador = temporario.getItem(CHAVE_DO_VERIFICADOR);
      temporario.removeItem(CHAVE_DO_VERIFICADOR);
      temporario.removeItem(CHAVE_DO_ESTADO);
      if (retorno.tipo === "codigo" && verificador) return this.trocarCodigo(retorno.codigo, verificador, this.ambiente.redirectUri(), "web");
      throw new Error("O login com o Google foi cancelado.");
    }
    const token = local.getItem(CHAVE_DO_TOKEN);
    if (!token) return;
    this.mudar({ carregando: true });
    try {
      this.mudar({ conta: await this.ambiente.api.eu(token), carregando: false });
    } catch (erro) {
      // Sessão vencida ou apagada no servidor: volta a ser convidado. Sem rede, mantém o token.
      if (erro instanceof ErroDaApi && erro.status === 401) local.removeItem(CHAVE_DO_TOKEN);
      this.mudar({ carregando: false });
    }
  }

  async entrar() {
    const verificador = gerarVerificador();
    const estado = gerarVerificador();
    const { loginPeloNavegador } = this.ambiente;
    if (loginPeloNavegador) {
      const url = urlDoLoginDoGoogle({ clientId: this.ambiente.clientId, desafio: await desafioDoVerificador(verificador), estado });
      const volta = await loginPeloNavegador(url);
      const retorno = lerRetornoDoGoogle(volta.busca, estado);
      if (retorno.tipo !== "codigo") throw new Error("O login com o Google foi cancelado.");
      return this.trocarCodigo(retorno.codigo, verificador, volta.redirectUri, "desktop");
    }
    this.ambiente.temporario.setItem(CHAVE_DO_VERIFICADOR, verificador);
    this.ambiente.temporario.setItem(CHAVE_DO_ESTADO, estado);
    const desafio = await desafioDoVerificador(verificador);
    this.ambiente.irPara(urlDoLoginDoGoogle({ clientId: this.ambiente.clientId, redirectUri: this.ambiente.redirectUri(), desafio, estado }));
  }

  async sair() {
    const token = this.ambiente.local.getItem(CHAVE_DO_TOKEN);
    this.ambiente.local.removeItem(CHAVE_DO_TOKEN);
    this.mudar({ conta: null });
    if (token) await this.ambiente.api.sair(token).catch(() => {});
  }

  /** Apaga a conta na API. Só esquece o token depois que a API confirmar. */
  async excluirConta() {
    const token = this.ambiente.local.getItem(CHAVE_DO_TOKEN);
    if (!token) return;
    await this.ambiente.api.excluirConta(token);
    this.ambiente.local.removeItem(CHAVE_DO_TOKEN);
    this.mudar({ conta: null });
  }

  /** As estatísticas de quem está logado. Sem conta, não pergunta à API. */
  async perfil(sinal?: AbortSignal) {
    const token = this.token();
    if (!token) throw new Error("Entre com o Google para ver o perfil.");
    return this.ambiente.api.perfil(token, sinal);
  }

  /** Os recordes de quem está logado. Sem conta, nenhum. */
  async recordes() {
    const token = this.token();
    return token ? this.ambiente.api.recordes(token) : [];
  }

  /** Manda a partida para a API e devolve o XP ganho, ou a vaga na fila de validação. Sem conta, não manda nada. */
  async registrarPartida(resultado: Resultado, replay?: Uint8Array): Promise<RegistroDaPartida | null> {
    const token = this.ambiente.local.getItem(CHAVE_DO_TOKEN);
    if (!token || !this.estadoAtual.conta) return null;
    const xp = await this.ambiente.api.registrarPartida(token, {
      musica_id: resultado.musicaId,
      dificuldade: resultado.dificuldade,
      instrumento: resultado.instrumento ?? "guitarra",
      pontos: resultado.pontos,
      acertos: resultado.acertos,
      total: resultado.total,
      derrota: resultado.derrota,
      fantasma: !!resultado.fantasma,
      maior_sequencia: resultado.maiorSequencia,
      ...(resultado.julgamentos && { valor_dos_acertos: valorDosAcertos(resultado.julgamentos) }),
      ...(replay && { replay: emBase64(replay) }),
    });
    if ("pendente" in xp) return xp;
    const conta = this.estadoAtual.conta;
    this.mudar({ conta: { ...conta, xp_total: conta.xp_total + xp.xp_ganho, nivel: xp.depois } });
    return xp;
  }

  private async trocarCodigo(codigo: string, verificador: string, redirectUri: string, cliente: ClienteDoGoogle) {
    this.mudar({ carregando: true });
    try {
      const { token, conta } = await this.ambiente.api.entrar(codigo, verificador, redirectUri, cliente);
      this.ambiente.local.setItem(CHAVE_DO_TOKEN, token);
      this.mudar({ conta, carregando: false });
    } catch (erro) {
      this.mudar({ carregando: false });
      throw erro;
    }
  }

  private mudar(parte: Partial<EstadoDaConta>) {
    this.estadoAtual = { ...this.estadoAtual, ...parte };
    for (const ouvinte of this.ouvintes) ouvinte();
  }
}

const noDesktop = "__TAURI_INTERNALS__" in window;
const CLIENT_ID = (noDesktop ? import.meta.env.VITE_GOOGLE_CLIENT_ID_DESKTOP : import.meta.env.VITE_GOOGLE_CLIENT_ID) ?? "";

// O build de produção nunca liga a conta falsa, mesmo com a variável no .env.
const CONTA_FALSA: ContaDaApi | undefined =
  import.meta.env.DEV && import.meta.env.VITE_CONTA_FALSA === "1"
    ? { id: "conta-falsa", nome: "Jogador de teste", avatar: null, email: null, xp_total: 1234, nivel: { nivel: 5, xp_no_nivel: 34, xp_para_o_proximo: 300 } }
    : undefined;

/** Sem API ou sem client id configurados, o app segue sem contas. A conta falsa só precisa da API. */
export const contasLigadas = !!URL_DA_API && (!!CLIENT_ID || !!CONTA_FALSA);

export const sessaoDaConta = new SessaoDaConta({
  api: criarApi(URL_DA_API),
  clientId: CLIENT_ID,
  local: localStorage,
  temporario: sessionStorage,
  redirectUri: () => `${location.origin}/`,
  irPara: (url) => location.assign(url),
  busca: () => location.search,
  limparBusca: () => history.replaceState(null, "", location.pathname),
  loginPeloNavegador: noDesktop ? (url) => invoke("login_pelo_navegador", { url }) : undefined,
  contaFalsa: CONTA_FALSA,
});

function emBase64(bytes: Uint8Array) {
  let texto = "";
  for (const byte of bytes) texto += String.fromCharCode(byte);
  return btoa(texto);
}
