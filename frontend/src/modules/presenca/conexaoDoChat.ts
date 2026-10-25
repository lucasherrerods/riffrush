import { BALDE_CHEIO, adicionarMensagem, gastarDoBalde, limparTexto } from "@/modules/chat";
import { urlDoChat } from "./protocolo";
import { SocketComFicha, type DependenciasDoSocket } from "./socketComFicha";

/** Como o relay manda cada mensagem (backend/relay/src/chat.ts). */
export interface MensagemGlobal {
  n: number;
  autor: { id: string; nome: string };
  texto: string;
  em: number;
}

export interface EstadoDoChatGlobal {
  conectado: boolean;
  mensagens: MensagemGlobal[];
}

/** O relay já limpa, mas quem recebe confere de novo: o que aparece na tela nunca depende só do servidor. */
function lerMensagem(valor: unknown): MensagemGlobal | null {
  const m = valor as Partial<MensagemGlobal> | null;
  const texto = limparTexto(m?.texto);
  const nome = limparTexto(m?.autor?.nome);
  if (!texto || !nome || typeof m?.n !== "number" || typeof m.autor?.id !== "string" || typeof m.em !== "number") return null;
  return { n: m.n, autor: { id: m.autor.id, nome: nome.slice(0, 40) }, texto, em: m.em };
}

export function aplicarMensagemDoChat(lista: MensagemGlobal[], bruta: string): MensagemGlobal[] {
  let msg: { tipo?: unknown; mensagens?: unknown; mensagem?: unknown };
  try {
    msg = JSON.parse(bruta);
  } catch {
    return lista;
  }
  if (msg?.tipo === "historico" && Array.isArray(msg.mensagens)) {
    return msg.mensagens.map(lerMensagem).filter((m): m is MensagemGlobal => m !== null).slice(-50);
  }
  if (msg?.tipo === "mensagem") {
    const nova = lerMensagem(msg.mensagem);
    return nova ? adicionarMensagem(lista, nova) : lista;
  }
  return lista;
}

export interface DependenciasDoChat extends DependenciasDoSocket {
  urlDoRelay: string;
}

const DESLIGADO: EstadoDoChatGlobal = { conectado: false, mensagens: [] };

/** A conexão com o chat global. Liga quando alguma tela mostra o chat e desliga quando nenhuma mostra. */
export class ConexaoDoChatGlobal {
  private estadoAtual = DESLIGADO;
  private ouvintes = new Set<() => void>();
  private socket: SocketComFicha;
  private usos = 0;
  /** O mesmo limite que o relay conta: a mensagem é recusada aqui, em vez de sumir lá. */
  private balde = BALDE_CHEIO;

  constructor(private deps: DependenciasDoChat) {
    this.socket = new SocketComFicha(deps, {
      url: (ficha) => urlDoChat(deps.urlDoRelay, ficha),
      aoAbrir: () => this.mudar({ ...this.estadoAtual, conectado: true }),
      aoReceber: (texto) => this.mudar({ ...this.estadoAtual, mensagens: aplicarMensagemDoChat(this.estadoAtual.mensagens, texto) }),
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

  /** Devolve false quando a mensagem não saiu (limite, ou sem conexão). */
  enviar(texto: string) {
    const limpo = limparTexto(texto);
    if (!limpo || !this.socket.aberto) return false;
    const limite = gastarDoBalde(this.balde, performance.now());
    this.balde = limite.balde;
    return limite.passa && this.socket.enviar(JSON.stringify({ texto: limpo }));
  }

  private mudar(estado: EstadoDoChatGlobal) {
    this.estadoAtual = estado;
    for (const ouvinte of this.ouvintes) ouvinte();
  }
}
