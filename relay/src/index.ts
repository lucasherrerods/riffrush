import { DurableObject } from "cloudflare:workers";
import { HOST, MAXIMO_DE_JOGADORES, codigoValido, dentroDoLimite, embrulhar, gerarCodigo, mensagemDoServidor, type Janela } from "./regras";

interface Env {
  SALAS: DurableObjectNamespace<Sala>;
}

interface Anexo {
  id: number;
}

const CABECALHO_DE_CRIAR = "x-riffrush-criar";
const CABECALHO_DO_CODIGO = "x-riffrush-codigo";
const TENTATIVAS_DE_CODIGO = 5;
/** Resposta da sala quando o código sorteado já está em uso. */
const CODIGO_EM_USO = 409;
/** Tags das conexões: só as de jogador contam na sala e recebem mensagens. */
const JOGADOR = "jogador";
const RECUSADO = "recusado";

/**
 * Uma sala por Durable Object, achada pelo código. A sala só repassa mensagens;
 * quem decide tudo continua sendo o cliente do host, como na LAN.
 */
export class Sala extends DurableObject<Env> {
  /** Some quando a sala hiberna, e tudo bem: o limite só precisa valer no curto prazo. */
  private janelas = new Map<WebSocket, Janela>();

  async fetch(pedido: Request): Promise<Response> {
    if (pedido.headers.get("Upgrade") !== "websocket") return new Response("Esperava um WebSocket.", { status: 426 });
    const codigo = pedido.headers.get(CABECALHO_DO_CODIGO) ?? "";
    const criar = pedido.headers.get(CABECALHO_DE_CRIAR) === "1";
    const existe = (await this.ctx.storage.get<boolean>("aberta")) === true;

    if (criar && (existe || (await this.ctx.storage.get("usada")))) return new Response(null, { status: CODIGO_EM_USO });

    const [cliente, servidor] = Object.values(new WebSocketPair());
    // A recusa também usa a hibernação: com accept() comum o runtime acusa erro quando o cliente some.
    const recusar = (motivo: "semSala" | "cheia") => {
      this.ctx.acceptWebSocket(servidor, [RECUSADO]);
      servidor.send(mensagemDoServidor({ tipo: motivo }));
      servidor.close(1000, motivo);
      return new Response(null, { status: 101, webSocket: cliente });
    };

    if (!criar && !existe) return recusar("semSala");
    if (this.ctx.getWebSockets(JOGADOR).length >= MAXIMO_DE_JOGADORES) return recusar("cheia");

    if (criar) await this.ctx.storage.put({ aberta: true, usada: true, proximoId: HOST });
    const id = (await this.ctx.storage.get<number>("proximoId")) ?? HOST;
    await this.ctx.storage.put("proximoId", id + 1);

    this.ctx.acceptWebSocket(servidor, [JOGADOR]);
    servidor.serializeAttachment({ id } satisfies Anexo);
    servidor.send(mensagemDoServidor({ tipo: "bemVindo", id, codigo }));
    return new Response(null, { status: 101, webSocket: cliente });
  }

  async webSocketMessage(socket: WebSocket, mensagem: string | ArrayBuffer) {
    if (typeof mensagem !== "string" || !this.ehJogador(socket)) return;
    const { id } = socket.deserializeAttachment() as Anexo;
    const limite = dentroDoLimite(this.janelas.get(socket) ?? { inicio: 0, contagem: 0 }, Date.now());
    this.janelas.set(socket, limite.janela);
    if (!limite.passa) return;
    const embrulhada = embrulhar(id, mensagem);
    if (embrulhada) this.paraTodos(embrulhada);
  }

  async webSocketClose(socket: WebSocket) {
    await this.saiu(socket);
  }

  async webSocketError(socket: WebSocket) {
    await this.saiu(socket);
  }

  private ehJogador(socket: WebSocket) {
    return this.ctx.getTags(socket).includes(JOGADOR);
  }

  private async saiu(socket: WebSocket) {
    if (!this.ehJogador(socket)) return;
    this.janelas.delete(socket);
    const { id } = socket.deserializeAttachment() as Anexo;
    // Sem o host não há quem mande na sala: ninguém mais entra, e os que estão saem sozinhos.
    if (id === HOST) await this.ctx.storage.put("aberta", false);
    this.paraTodos(mensagemDoServidor({ tipo: "saiu" }, id), socket);
    try {
      socket.close(1000, "saiu");
    } catch {
      // Já estava fechado.
    }
    const restantes = this.ctx.getWebSockets(JOGADOR).filter((s) => s !== socket);
    // Sala vazia: libera o armazenamento. "usada" fica para o código não voltar enquanto houver alguém.
    if (restantes.length === 0) await this.ctx.storage.deleteAll();
  }

  private paraTodos(texto: string, exceto?: WebSocket) {
    for (const socket of this.ctx.getWebSockets(JOGADOR)) {
      if (socket === exceto) continue;
      try {
        socket.send(texto);
      } catch {
        // Conexão caindo: o webSocketClose dela cuida da saída.
      }
    }
  }
}

function encaminhar(pedido: Request, env: Env, codigo: string, criar: boolean) {
  const cabecalhos = new Headers(pedido.headers);
  cabecalhos.set(CABECALHO_DO_CODIGO, codigo);
  cabecalhos.set(CABECALHO_DE_CRIAR, criar ? "1" : "0");
  return env.SALAS.get(env.SALAS.idFromName(codigo)).fetch(new Request(pedido, { headers: cabecalhos }));
}

export default {
  async fetch(pedido: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(pedido.url);

    if (pathname === "/criar") {
      for (let i = 0; i < TENTATIVAS_DE_CODIGO; i++) {
        const resposta = await encaminhar(pedido, env, gerarCodigo(Math.random), true);
        if (resposta.status !== CODIGO_EM_USO) return resposta;
      }
      return new Response("Não consegui sortear um código livre.", { status: 503 });
    }

    const sala = /^\/sala\/([^/]+)$/.exec(pathname);
    if (sala && codigoValido(sala[1])) return encaminhar(pedido, env, sala[1], false);

    return new Response("Riff Rush relay", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
