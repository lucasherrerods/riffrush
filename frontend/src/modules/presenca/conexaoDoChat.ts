import { BALDE_CHEIO, MENSAGENS_GUARDADAS, adicionarMensagem, gastarDoBalde, limparTexto } from "@/modules/chat";
import { urlDoChat } from "./protocolo";
import { SocketComFicha, type DependenciasDoSocket } from "./socketComFicha";

/* Como o relay manda cada coisa (backend/relay/src/chat.ts). */

export interface AutorGlobal {
  id: string;
  nome: string;
  /** Conta da equipe: aparece com o selo. */
  equipe?: true;
}

export interface MensagemGlobal {
  n: number;
  autor: AutorGlobal;
  texto: string;
  em: number;
}

export interface Permissoes {
  podeEscrever: boolean;
  admin: boolean;
  banido: boolean;
  nivelParaEscrever: number;
}

export interface Denuncia {
  mensagem: MensagemGlobal;
  por: AutorGlobal;
  em: number;
}

export interface EstadoDoChatGlobal {
  conectado: boolean;
  mensagens: MensagemGlobal[];
  /** null até o relay dizer o que a pessoa pode fazer. */
  voce: Permissoes | null;
  /** Só chegam para a equipe. */
  denuncias: Denuncia[];
  banidos: AutorGlobal[];
}

const TAMANHO_MAXIMO_DO_NOME = 80;
const ehObjeto = (valor: unknown): valor is Record<string, unknown> => typeof valor === "object" && valor !== null;

function lerAutor(valor: unknown): AutorGlobal | null {
  if (!ehObjeto(valor) || typeof valor.id !== "string") return null;
  const nome = limparTexto(valor.nome)?.slice(0, TAMANHO_MAXIMO_DO_NOME);
  if (!nome) return null;
  return { id: valor.id, nome, ...(valor.equipe === true && { equipe: true as const }) };
}

/** O relay já limpa, mas quem recebe confere de novo: o que aparece na tela nunca depende só do servidor. */
function lerMensagem(valor: unknown): MensagemGlobal | null {
  if (!ehObjeto(valor)) return null;
  const texto = limparTexto(valor.texto);
  const autor = lerAutor(valor.autor);
  if (!texto || !autor || typeof valor.n !== "number" || typeof valor.em !== "number") return null;
  return { n: valor.n, autor, texto, em: valor.em };
}

function lerPermissoes(valor: unknown): Permissoes | null {
  if (!ehObjeto(valor)) return null;
  return {
    podeEscrever: valor.podeEscrever === true,
    admin: valor.admin === true,
    banido: valor.banido === true,
    nivelParaEscrever: typeof valor.nivelParaEscrever === "number" ? valor.nivelParaEscrever : 2,
  };
}

function lerDenuncia(valor: unknown): Denuncia | null {
  if (!ehObjeto(valor)) return null;
  const mensagem = lerMensagem(valor.mensagem);
  const por = lerAutor(valor.por);
  return mensagem && por && typeof valor.em === "number" ? { mensagem, por, em: valor.em } : null;
}

const validos = <T,>(lista: unknown, ler: (v: unknown) => T | null) => (Array.isArray(lista) ? lista.map(ler).filter((v): v is T => v !== null) : []);

export function aplicarMensagemDoChat(estado: EstadoDoChatGlobal, bruta: string): EstadoDoChatGlobal {
  let msg: unknown;
  try {
    msg = JSON.parse(bruta);
  } catch {
    return estado;
  }
  if (!ehObjeto(msg)) return estado;
  switch (msg.tipo) {
    case "historico":
      return { ...estado, mensagens: validos(msg.mensagens, lerMensagem).slice(-MENSAGENS_GUARDADAS), voce: lerPermissoes(msg.voce) ?? estado.voce };
    case "mensagem": {
      const nova = lerMensagem(msg.mensagem);
      return nova ? { ...estado, mensagens: adicionarMensagem(estado.mensagens, nova) } : estado;
    }
    case "apagadas": {
      const ns = validos(msg.ns, (n) => (typeof n === "number" ? n : null));
      return { ...estado, mensagens: estado.mensagens.filter((m) => !ns.includes(m.n)) };
    }
    case "voce":
      return { ...estado, voce: lerPermissoes(msg.voce) ?? estado.voce };
    case "denuncias":
      return { ...estado, denuncias: validos(msg.denuncias, lerDenuncia) };
    case "banidos":
      return { ...estado, banidos: validos(msg.banidos, lerAutor) };
    default:
      return estado;
  }
}

export interface DependenciasDoChat extends DependenciasDoSocket {
  urlDoRelay: string;
}

const DESLIGADO: EstadoDoChatGlobal = { conectado: false, mensagens: [], voce: null, denuncias: [], banidos: [] };

/** A conexão com o chat global. Liga quando alguma tela mostra o chat e desliga quando nenhuma mostra. */
export class ConexaoDoChatGlobal {
  private estadoAtual = DESLIGADO;
  private ouvintes = new Set<() => void>();
  private socket: SocketComFicha;
  private usos = 0;
  /** O mesmo limite que o relay conta (mensagens, denúncias e comandos): o pedido é recusado aqui, em vez de sumir lá. */
  private balde = BALDE_CHEIO;

  constructor(private deps: DependenciasDoChat) {
    this.socket = new SocketComFicha(deps, {
      url: urlDoChat(deps.urlDoRelay),
      aoAbrir: () => this.mudar({ ...this.estadoAtual, conectado: true }),
      aoReceber: (texto) => this.mudar(aplicarMensagemDoChat(this.estadoAtual, texto)),
      aoCair: () => this.mudar({ ...this.estadoAtual, conectado: false }),
    });
  }

  inscrever = (ouvinte: () => void) => {
    this.ouvintes.add(ouvinte);
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  };

  estado = () => this.estadoAtual;

  ligar() {
    if (this.deps.urlDoRelay) this.socket.ligar();
  }

  desligar() {
    this.socket.desligar();
    this.mudar(DESLIGADO);
  }

  /** Uma tela passou a mostrar o chat; a função devolvida avisa que ela saiu. */
  usar() {
    if (this.usos++ === 0) this.ligar();
    return () => {
      if (--this.usos === 0) this.desligar();
    };
  }

  /** Devolve false quando a mensagem não saiu (limite, sem permissão ou sem conexão). */
  enviar(texto: string) {
    const limpo = limparTexto(texto);
    if (!limpo || !this.estadoAtual.voce?.podeEscrever) return false;
    return this.comando({ tipo: "mensagem", texto: limpo });
  }

  denunciar = (n: number) => this.comando({ tipo: "denunciar", n });
  apagar = (n: number) => this.comando({ tipo: "apagar", n });
  resolver = (n: number) => this.comando({ tipo: "resolver", n });
  banir = (id: string) => this.comando({ tipo: "banir", id });
  desbanir = (id: string) => this.comando({ tipo: "desbanir", id });

  private comando(comando: object) {
    if (!this.socket.aberto) return false;
    const limite = gastarDoBalde(this.balde, performance.now());
    this.balde = limite.balde;
    return limite.passa && this.socket.enviar(JSON.stringify(comando));
  }

  private mudar(estado: EstadoDoChatGlobal) {
    this.estadoAtual = estado;
    for (const ouvinte of this.ouvintes) ouvinte();
  }
}
