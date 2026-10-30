import { DurableObject } from "cloudflare:workers";
import {
  HOST,
  MAXIMO_DE_JOGADORES,
  codigoValido,
  dentroDoLimite,
  embrulhar,
  expulsoPeloHost,
  gerarCodigo,
  listarSalas,
  mensagemDoServidor,
  nomeDoHost,
  salaPublica,
  novoHost,
  type EntradaDaSala,
  type Janela,
} from "./regras";
import { CABECALHO_DA_ASSINATURA, CABECALHO_DA_HORA, assinarPedido, conferirPedido } from "./assinatura";
import {
  BALDE_CHEIO,
  MENSAGENS_GUARDADAS,
  NIVEL_PARA_ESCREVER,
  chaveDaMensagem,
  gastarDoBalde,
  lerAvisoDaApi,
  lerComando,
  nomeParaMostrar,
  podeEscrever,
  recentes,
  type Autor,
  type AvisoDaApi,
  type Balde,
  type MensagemDoChat,
  type MensagemDoChatGlobal,
  type Permissoes,
} from "./chat";
import {
  PROTOCOLO_DO_JOGO,
  avisoDeEspectadores,
  fichaDoPedido,
  lerComandoDaPresenca,
  lerMensagemDaTransmissao,
  verificarFicha,
  type MensagemDaPresenca,
  type PessoaDaFicha,
  type PessoaOnline,
} from "./presenca";

interface Env {
  SALAS: DurableObjectNamespace<Sala>;
  DIRETORIO: DurableObjectNamespace<Diretorio>;
  PRESENCA: DurableObjectNamespace<Presenca>;
  TRANSMISSOES: DurableObjectNamespace<Transmissao>;
  CHAT: DurableObjectNamespace<ChatGlobal>;
  /** O endereço da API (`https://...`), para onde vão as denúncias do chat global. */
  URL_DA_API?: string;
  /** Limite de pedidos por IP (`[[ratelimits]]` no wrangler.toml). */
  LIMITE_POR_IP?: RateLimit;
  /** O mesmo SEGREDO_DO_RELAY da API (`npx wrangler secret put SEGREDO_DA_PRESENCA`). */
  SEGREDO_DA_PRESENCA?: string;
}

interface Anexo {
  id: number;
}

const CABECALHO_DE_CRIAR = "x-riffrush-criar";
const CABECALHO_DO_CODIGO = "x-riffrush-codigo";
const CABECALHO_DO_NOME = "x-riffrush-nome";
const CABECALHO_DA_VISIBILIDADE = "x-riffrush-publica";
/** De quanto em quanto tempo a sala aberta renova a entrada no diretório. */
const RENOVACAO_MS = 60 * 1000;
const PREFIXO = "sala:";
const TENTATIVAS_DE_CODIGO = 5;
/** Resposta da sala quando o código sorteado já está em uso. */
const CODIGO_EM_USO = 409;
/** Tags das conexões: só as de jogador contam na sala e recebem mensagens. */
const JOGADOR = "jogador";
const RECUSADO = "recusado";

/** As salas online abertas, para quem procura uma sala sem ter o código. Um só para o relay todo. */
export class Diretorio extends DurableObject<Env> {
  async publicar(entrada: Omit<EntradaDaSala, "atualizadaEm">) {
    await this.ctx.storage.put(PREFIXO + entrada.codigo, { ...entrada, atualizadaEm: Date.now() } satisfies EntradaDaSala);
  }

  async remover(codigo: string) {
    await this.ctx.storage.delete(PREFIXO + codigo);
  }

  async listar() {
    const entradas = [...(await this.ctx.storage.list<EntradaDaSala>({ prefix: PREFIXO })).values()];
    const visiveis = listarSalas(entradas, Date.now());
    // Aproveita para limpar as que expiraram: o host sumiu sem a sala avisar.
    const expiradas = entradas.filter((e) => !visiveis.some((v) => v.codigo === e.codigo)).map((e) => PREFIXO + e.codigo);
    if (expiradas.length) await this.ctx.storage.delete(expiradas);
    return visiveis;
  }
}

const diretorio = (env: Env) => env.DIRETORIO.get(env.DIRETORIO.idFromName("diretorio"));

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

    if (criar) {
      await this.ctx.storage.put({
        aberta: true,
        usada: true,
        proximoId: HOST,
        codigo,
        nome: nomeDoHost(pedido.headers.get(CABECALHO_DO_NOME)),
        publica: salaPublica(pedido.headers.get(CABECALHO_DA_VISIBILIDADE)),
      });
      await this.ctx.storage.setAlarm(Date.now() + RENOVACAO_MS);
    }
    const id = (await this.ctx.storage.get<number>("proximoId")) ?? HOST;
    await this.ctx.storage.put("proximoId", id + 1);

    this.ctx.acceptWebSocket(servidor, [JOGADOR]);
    servidor.serializeAttachment({ id } satisfies Anexo);
    servidor.send(mensagemDoServidor({ tipo: "bemVindo", id, codigo }));
    await this.publicar();
    return new Response(null, { status: 101, webSocket: cliente });
  }

  /** Renova a entrada no diretório enquanto a sala estiver aberta. */
  async alarm() {
    if (!(await this.ctx.storage.get<boolean>("aberta"))) return;
    await this.publicar();
    await this.ctx.storage.setAlarm(Date.now() + RENOVACAO_MS);
  }

  private async publicar(saindo?: WebSocket) {
    const codigo = await this.ctx.storage.get<string>("codigo");
    if (!codigo) return;
    const listada = (await this.ctx.storage.get<boolean>("aberta")) && (await this.ctx.storage.get<boolean>("publica")) !== false;
    if (!listada) return void (await diretorio(this.env).remover(codigo));
    const jogadores = this.ctx.getWebSockets(JOGADOR).filter((s) => s !== saindo).length;
    await diretorio(this.env).publicar({ codigo, nome: (await this.ctx.storage.get<string>("nome")) ?? nomeDoHost(null), jogadores });
  }

  async webSocketMessage(socket: WebSocket, mensagem: string | ArrayBuffer) {
    if (typeof mensagem !== "string" || !this.ehJogador(socket)) return;
    const { id } = socket.deserializeAttachment() as Anexo;
    const limite = dentroDoLimite(this.janelas.get(socket) ?? { inicio: 0, contagem: 0 }, Date.now());
    this.janelas.set(socket, limite.janela);
    if (!limite.passa) return;
    const embrulhada = embrulhar(id, mensagem);
    if (!embrulhada) return;
    const presentes = this.ctx.getWebSockets(JOGADOR).map((s) => (s.deserializeAttachment() as Anexo).id);
    const host = await this.hostAtual();
    const novo = novoHost(id, host, mensagem, presentes);
    if (novo !== null) await this.ctx.storage.put("host", novo);
    this.paraTodos(embrulhada);
    // O expulso recebe o aviso acima e só então sai: assim ele vê o motivo, e não "a conexão caiu".
    const expulso = expulsoPeloHost(id, host, mensagem, presentes);
    const socketDoExpulso = this.ctx.getWebSockets(JOGADOR).find((s) => (s.deserializeAttachment() as Anexo).id === expulso);
    if (socketDoExpulso) await this.saiu(socketDoExpulso);
  }

  async webSocketClose(socket: WebSocket) {
    await this.saiu(socket);
  }

  async webSocketError(socket: WebSocket) {
    await this.saiu(socket);
  }

  private async hostAtual() {
    return (await this.ctx.storage.get<number>("host")) ?? HOST;
  }

  private ehJogador(socket: WebSocket) {
    return this.ctx.getTags(socket).includes(JOGADOR);
  }

  private async saiu(socket: WebSocket) {
    if (!this.ehJogador(socket)) return;
    this.janelas.delete(socket);
    const { id } = socket.deserializeAttachment() as Anexo;
    // Sem o host não há quem mande na sala: ninguém mais entra, e os que estão saem sozinhos.
    if (id === (await this.hostAtual())) await this.ctx.storage.put("aberta", false);
    await this.publicar(socket);
    this.paraTodos(mensagemDoServidor({ tipo: "saiu" }, id), socket);
    try {
      socket.close(1000, "saiu");
    } catch {
      // Já estava fechado.
    }
    const restantes = this.ctx.getWebSockets(JOGADOR).filter((s) => s !== socket);
    // Sala vazia: libera o armazenamento. "usada" fica para o código não voltar enquanto houver alguém.
    if (restantes.length === 0) {
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
    }
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

const CABECALHO_DA_PESSOA = "x-riffrush-pessoa";
const PESSOA = "pessoa";
const QUEM_JOGA = "jogador";
const QUEM_ASSISTE = "espectador";

function enviar(socket: WebSocket, texto: string) {
  try {
    socket.send(texto);
  } catch {
    // Conexão caindo: o webSocketClose dela cuida do resto.
  }
}

function fechar(socket: WebSocket, motivo: string) {
  try {
    socket.close(1000, motivo);
  } catch {
    // Já estava fechado.
  }
}

/**
 * Quem está online agora. Um só para o relay todo; cada conexão guarda a pessoa no anexo,
 * que sobrevive à hibernação, então a lista sai das próprias conexões abertas.
 */
export class Presenca extends DurableObject<Env> {
  private janelas = new Map<WebSocket, Janela>();

  async fetch(pedido: Request): Promise<Response> {
    if (pedido.headers.get("Upgrade") !== "websocket") return new Response("Esperava um WebSocket.", { status: 426 });
    // O nível só serve para o chat: a lista de quem está online não precisa dele.
    const { nivel: _, ...pessoa } = JSON.parse(pedido.headers.get(CABECALHO_DA_PESSOA) ?? "null") as PessoaDaFicha;
    // A mesma conta em outro aparelho: a conexão antiga sai, para não aparecer duas vezes.
    for (const antiga of this.ctx.getWebSockets(PESSOA)) {
      if ((antiga.deserializeAttachment() as PessoaOnline).id === pessoa.id) fechar(antiga, "outroAparelho");
    }
    const [cliente, servidor] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(servidor, [PESSOA]);
    const online: PessoaOnline = { ...pessoa, estado: { tipo: "menu" } };
    servidor.serializeAttachment(online);
    enviar(servidor, JSON.stringify({ tipo: "lista", pessoas: this.pessoas() } satisfies MensagemDaPresenca));
    this.paraTodos({ tipo: "pessoa", pessoa: online }, servidor);
    return respostaDoSocket(pedido, cliente);
  }

  async webSocketMessage(socket: WebSocket, mensagem: string | ArrayBuffer) {
    if (typeof mensagem !== "string" || mensagem.length > TAMANHO_DO_ESTADO) return;
    const limite = dentroDoLimite(this.janelas.get(socket) ?? { inicio: 0, contagem: 0 }, Date.now());
    this.janelas.set(socket, limite.janela);
    if (!limite.passa) return;
    const comando = lerComandoDaPresenca(mensagem);
    if (!comando) return;
    const atual = socket.deserializeAttachment() as PessoaOnline;
    if (comando.tipo === "convite") {
      const { id, nome, avatar } = atual;
      const convite = JSON.stringify({ tipo: "convite", de: { id, nome, avatar }, codigo: comando.codigo } satisfies MensagemDaPresenca);
      for (const destino of this.ctx.getWebSockets(PESSOA)) {
        if ((destino.deserializeAttachment() as PessoaOnline).id === comando.para) enviar(destino, convite);
      }
      return;
    }
    const pessoa: PessoaOnline = { ...atual, estado: comando.estado };
    socket.serializeAttachment(pessoa);
    this.paraTodos({ tipo: "pessoa", pessoa });
  }

  async webSocketClose(socket: WebSocket) {
    this.saiu(socket);
  }

  async webSocketError(socket: WebSocket) {
    this.saiu(socket);
  }

  private saiu(socket: WebSocket) {
    this.janelas.delete(socket);
    const { id } = socket.deserializeAttachment() as PessoaOnline;
    fechar(socket, "saiu");
    // Se a mesma conta já abriu outra conexão, ela continua na lista.
    const continua = this.ctx.getWebSockets(PESSOA).some((s) => s !== socket && (s.deserializeAttachment() as PessoaOnline).id === id);
    if (!continua) this.paraTodos({ tipo: "saiu", id }, socket);
  }

  private pessoas() {
    return this.ctx.getWebSockets(PESSOA).map((s) => s.deserializeAttachment() as PessoaOnline);
  }

  private paraTodos(mensagem: MensagemDaPresenca, exceto?: WebSocket) {
    const texto = JSON.stringify(mensagem);
    for (const socket of this.ctx.getWebSockets(PESSOA)) if (socket !== exceto) enviar(socket, texto);
  }
}

/** O estado é pequeno: música, dificuldade e instrumento. */
const TAMANHO_DO_ESTADO = 1024;

/**
 * A partida ao vivo de uma pessoa: guarda o início e os lotes de entradas desde o começo da música,
 * para quem chega no meio alcançar a partida, e repassa cada lote novo para quem está assistindo.
 */
export class Transmissao extends DurableObject<Env> {
  private janelas = new Map<WebSocket, Janela>();

  async fetch(pedido: Request): Promise<Response> {
    if (pedido.headers.get("Upgrade") !== "websocket") return new Response("Esperava um WebSocket.", { status: 426 });
    const [cliente, servidor] = Object.values(new WebSocketPair());
    if (pedido.headers.get(CABECALHO_DA_PESSOA)) {
      for (const antigo of this.ctx.getWebSockets(QUEM_JOGA)) fechar(antigo, "outraPartida");
      this.ctx.acceptWebSocket(servidor, [QUEM_JOGA]);
      // Recomeçar a música abre uma conexão nova: quem já assistia continua contando.
      enviar(servidor, avisoDeEspectadores(this.ctx.getWebSockets(QUEM_ASSISTE).length));
      return respostaDoSocket(pedido, cliente);
    }
    this.ctx.acceptWebSocket(servidor, [QUEM_ASSISTE]);
    // Quem chega no meio recebe tudo o que já aconteceu, num lote só.
    const inicio = await this.ctx.storage.get<string>("inicio");
    if (!inicio || this.ctx.getWebSockets(QUEM_JOGA).length === 0) {
      enviar(servidor, JSON.stringify({ tipo: "semPartida" }));
      fechar(servidor, "semPartida");
      return new Response(null, { status: 101, webSocket: cliente });
    }
    enviar(servidor, inicio);
    const lotes = [...(await this.ctx.storage.list<{ ate: number; entradas: [number, number][] }>({ prefix: "lote:" })).values()];
    if (lotes.length) {
      enviar(servidor, JSON.stringify({ tipo: "lote", ate: lotes[lotes.length - 1].ate, entradas: lotes.flatMap((l) => l.entradas) }));
    }
    const pausado = await this.ctx.storage.get<boolean>("pausado");
    if (pausado) enviar(servidor, JSON.stringify({ tipo: "pausa", pausado: true }));
    this.contarEspectadores();
    return new Response(null, { status: 101, webSocket: cliente });
  }

  async webSocketMessage(socket: WebSocket, bruta: string | ArrayBuffer) {
    if (typeof bruta !== "string" || !this.ctx.getTags(socket).includes(QUEM_JOGA)) return;
    const limite = dentroDoLimite(this.janelas.get(socket) ?? { inicio: 0, contagem: 0 }, Date.now());
    this.janelas.set(socket, limite.janela);
    if (!limite.passa) return;
    const mensagem = lerMensagemDaTransmissao(bruta);
    if (!mensagem) return;
    const texto = JSON.stringify(mensagem);
    if (mensagem.tipo === "inicio") {
      await this.ctx.storage.deleteAll();
      await this.ctx.storage.put({ inicio: texto, proximoLote: 0 });
    } else if (mensagem.tipo === "lote") {
      const numero = (await this.ctx.storage.get<number>("proximoLote")) ?? 0;
      await this.ctx.storage.put({ [`lote:${String(numero).padStart(6, "0")}`]: { ate: mensagem.ate, entradas: mensagem.entradas }, proximoLote: numero + 1 });
    } else if (mensagem.tipo === "pausa") {
      await this.ctx.storage.put("pausado", mensagem.pausado);
    } else {
      await this.ctx.storage.deleteAll();
    }
    for (const espectador of this.ctx.getWebSockets(QUEM_ASSISTE)) enviar(espectador, texto);
  }

  async webSocketClose(socket: WebSocket) {
    await this.saiu(socket);
  }

  async webSocketError(socket: WebSocket) {
    await this.saiu(socket);
  }

  /** Avisa quem joga quantas pessoas estão assistindo. `saindo` ainda aparece na lista enquanto fecha. */
  private contarEspectadores(saindo?: WebSocket) {
    const quantos = this.ctx.getWebSockets(QUEM_ASSISTE).filter((s) => s !== saindo).length;
    for (const jogador of this.ctx.getWebSockets(QUEM_JOGA)) enviar(jogador, avisoDeEspectadores(quantos));
  }

  private async saiu(socket: WebSocket) {
    this.janelas.delete(socket);
    fechar(socket, "saiu");
    if (!this.ctx.getTags(socket).includes(QUEM_JOGA)) {
      this.contarEspectadores(socket);
      return;
    }
    if (this.ctx.getWebSockets(QUEM_JOGA).some((s) => s !== socket)) return;
    // Quem jogava saiu: a partida acaba para quem assiste e o armazenamento é liberado.
    await this.ctx.storage.deleteAll();
    for (const espectador of this.ctx.getWebSockets(QUEM_ASSISTE)) {
      enviar(espectador, JSON.stringify({ tipo: "fim" }));
      fechar(espectador, "fim");
    }
  }
}

const QUEM_CONVERSA = "conversa";

/** O que fica no anexo de cada conexão do chat: sobrevive à hibernação. */
interface Conversando {
  autor: Autor;
  nivel: number;
  admin: boolean;
  banido: boolean;
}

/**
 * O chat global: um só para o relay todo. Só entra quem tem conta (a ficha da API), então o nome
 * de quem escreve vem assinado e ninguém fala pelo outro. Aqui ficam só as mensagens (24 horas):
 * quem é da moderação, quem está banido e as denúncias ficam no banco da API.
 */
export class ChatGlobal extends DurableObject<Env> {
  /**
   * O limite de cada conta. Some quando o objeto hiberna, e tudo bem: ele só hiberna depois de
   * alguns segundos sem mensagens, e aí o balde de todo mundo já estaria cheio de novo.
   */
  private baldes = new Map<string, Balde>();

  async fetch(pedido: Request): Promise<Response> {
    if (pedido.headers.get("Upgrade") !== "websocket") return new Response("Esperava um WebSocket.", { status: 426 });
    const pessoa = JSON.parse(pedido.headers.get(CABECALHO_DA_PESSOA) ?? "null") as PessoaDaFicha;
    // Uma conexão por conta: abrir outra não multiplica o limite de mensagens.
    for (const antiga of this.ctx.getWebSockets(QUEM_CONVERSA)) {
      if ((antiga.deserializeAttachment() as Conversando).autor.id === pessoa.id) fechar(antiga, "outroAparelho");
    }
    const conversando: Conversando = {
      autor: { id: pessoa.id, nome: nomeParaMostrar(pessoa.nome, pessoa.admin), ...(pessoa.admin && { moderacao: true as const }) },
      nivel: pessoa.nivel,
      admin: pessoa.admin,
      banido: pessoa.banido,
    };
    const [cliente, servidor] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(servidor, [QUEM_CONVERSA]);
    servidor.serializeAttachment(conversando);
    enviar(servidor, JSON.stringify({ tipo: "historico", mensagens: await this.mensagens(), voce: permissoes(conversando) } satisfies MensagemDoChatGlobal));
    return respostaDoSocket(pedido, cliente);
  }

  async webSocketMessage(socket: WebSocket, bruta: string | ArrayBuffer) {
    if (typeof bruta !== "string") return;
    const quem = socket.deserializeAttachment() as Conversando;
    const agora = Date.now();
    // Denúncias e comandos gastam do mesmo balde: ninguém inunda a moderação.
    const limite = gastarDoBalde(this.baldes.get(quem.autor.id) ?? BALDE_CHEIO, agora);
    this.baldes.set(quem.autor.id, limite.balde);
    if (!limite.passa) return;
    const comando = lerComando(bruta);
    if (!comando) return;

    if (comando.tipo === "mensagem") {
      if (!permissoes(quem).podeEscrever) return;
      const n = ((await this.ctx.storage.get<number>("ultima")) ?? 0) + 1;
      const mensagem: MensagemDoChat = { n, autor: quem.autor, texto: comando.texto, em: agora };
      await this.ctx.storage.put({ ultima: n, [chaveDaMensagem(n)]: mensagem });
      if (n > MENSAGENS_GUARDADAS) await this.ctx.storage.delete(chaveDaMensagem(n - MENSAGENS_GUARDADAS));
      return this.paraTodos({ tipo: "mensagem", mensagem });
    }

    if (comando.tipo === "denunciar") {
      // O relay tem a mensagem verdadeira: quem denuncia não consegue inventar o que foi escrito.
      const mensagem = await this.ctx.storage.get<MensagemDoChat>(chaveDaMensagem(comando.n));
      if (!mensagem || mensagem.autor.id === quem.autor.id) return;
      this.ctx.waitUntil(enviarDenuncia(this.env, mensagem, quem.autor.id));
      return;
    }

    // Apagar uma mensagem é da moderação e vale só aqui, onde as mensagens ficam.
    if (!quem.admin) return;
    await this.ctx.storage.delete(chaveDaMensagem(comando.n));
    this.paraTodos({ tipo: "apagadas", ns: [comando.n] });
  }

  /** A API avisa quando a moderação bane ou desbane: quem já está conectado muda na hora. */
  async moderar(aviso: AvisoDaApi) {
    const banido = aviso.tipo === "banir";
    if (banido) {
      // O que o banido escreveu some da conversa de todo mundo.
      const dele = (await this.mensagens()).filter((m) => m.autor.id === aviso.id).map((m) => m.n);
      if (dele.length) {
        await this.ctx.storage.delete(dele.map(chaveDaMensagem));
        this.paraTodos({ tipo: "apagadas", ns: dele });
      }
    }
    for (const conectado of this.ctx.getWebSockets(QUEM_CONVERSA)) {
      const quem = conectado.deserializeAttachment() as Conversando;
      if (quem.autor.id !== aviso.id || quem.admin) continue;
      const atualizado = { ...quem, banido };
      conectado.serializeAttachment(atualizado);
      enviar(conectado, JSON.stringify({ tipo: "voce", voce: permissoes(atualizado) } satisfies MensagemDoChatGlobal));
    }
  }

  async webSocketClose(socket: WebSocket) {
    fechar(socket, "saiu");
  }

  async webSocketError(socket: WebSocket) {
    fechar(socket, "saiu");
  }

  /** As mensagens das últimas 24 horas; as mais velhas são apagadas do armazenamento aqui. */
  private async mensagens() {
    const todas = [...(await this.ctx.storage.list<MensagemDoChat>({ prefix: "msg:" })).values()];
    const vivas = recentes(todas, Date.now());
    if (vivas.length < todas.length) await this.ctx.storage.delete(todas.filter((m) => !vivas.includes(m)).map((m) => chaveDaMensagem(m.n)));
    return vivas;
  }

  private paraTodos(mensagem: MensagemDoChatGlobal) {
    const texto = JSON.stringify(mensagem);
    for (const conectado of this.ctx.getWebSockets(QUEM_CONVERSA)) enviar(conectado, texto);
  }
}

const permissoes = (quem: Conversando): Permissoes => ({
  podeEscrever: podeEscrever(quem),
  admin: quem.admin,
  banido: quem.banido && !quem.admin,
  nivelParaEscrever: NIVEL_PARA_ESCREVER,
});

/** Manda a cópia da mensagem denunciada para a API, onde a moderação vê. Sem a API configurada, a denúncia não sai. */
async function enviarDenuncia(env: Env, mensagem: MensagemDoChat, denunciante: string) {
  const segredo = env.SEGREDO_DA_PRESENCA ?? "";
  if (!env.URL_DA_API || !segredo) return;
  const corpo = JSON.stringify({
    mensagem_n: mensagem.n,
    autor_id: mensagem.autor.id,
    autor_nome: mensagem.autor.nome,
    texto: mensagem.texto,
    mensagem_em: mensagem.em,
    denunciante_id: denunciante,
  });
  const hora = Math.floor(Date.now() / 1000);
  try {
    const resposta = await fetch(`${env.URL_DA_API.replace(/\/+$/, "")}/moderacao/denuncias`, {
      method: "POST",
      headers: { "Content-Type": "application/json", [CABECALHO_DA_HORA]: String(hora), [CABECALHO_DA_ASSINATURA]: await assinarPedido(segredo, hora, corpo) },
      body: corpo,
    });
    if (!resposta.ok) console.warn("a API recusou a denúncia", resposta.status);
  } catch (erro) {
    console.warn("não consegui mandar a denúncia para a API", String(erro));
  }
}

/** A rota que a API chama para avisar banimentos, com o pedido assinado pelo segredo em comum. */
async function avisoDeModeracao(pedido: Request, env: Env) {
  if (pedido.method !== "POST") return new Response("Esperava POST.", { status: 405 });
  const corpo = await pedido.text();
  const hora = Number(pedido.headers.get(CABECALHO_DA_HORA));
  const confere = await conferirPedido(env.SEGREDO_DA_PRESENCA ?? "", hora, Math.floor(Date.now() / 1000), corpo, pedido.headers.get(CABECALHO_DA_ASSINATURA) ?? "");
  if (!confere) return new Response("Assinatura inválida.", { status: 401 });
  const aviso = lerAvisoDaApi(corpo);
  if (!aviso) return new Response("Aviso inválido.", { status: 400 });
  await env.CHAT.get(env.CHAT.idFromName("chat")).moderar(aviso);
  return new Response(null, { status: 204 });
}

/** Com a ficha no subprotocolo, a resposta precisa aceitar o mesmo protocolo, ou o navegador fecha a conexão. */
function respostaDoSocket(pedido: Request, cliente: WebSocket) {
  const peloProtocolo = fichaDoPedido(pedido).peloProtocolo;
  return new Response(null, { status: 101, webSocket: cliente, headers: peloProtocolo ? { "Sec-WebSocket-Protocol": PROTOCOLO_DO_JOGO } : {} });
}

/** Confere a ficha (do subprotocolo ou da URL) e passa a pessoa para o Durable Object num cabeçalho que o cliente não consegue mandar. */
async function comPessoa(pedido: Request, env: Env) {
  const { ficha } = fichaDoPedido(pedido);
  const pessoa = await verificarFicha(ficha, env.SEGREDO_DA_PRESENCA ?? "", Math.floor(Date.now() / 1000));
  if (!pessoa) return null;
  const cabecalhos = new Headers(pedido.headers);
  cabecalhos.set(CABECALHO_DA_PESSOA, JSON.stringify(pessoa));
  return { pessoa, pedido: new Request(pedido, { headers: cabecalhos }) };
}

function encaminhar(pedido: Request, env: Env, codigo: string, criar: boolean) {
  const cabecalhos = new Headers(pedido.headers);
  if (criar) {
    cabecalhos.set(CABECALHO_DO_NOME, new URL(pedido.url).searchParams.get("nome") ?? "");
    cabecalhos.set(CABECALHO_DA_VISIBILIDADE, new URL(pedido.url).searchParams.get("publica") ?? "1");
  }
  cabecalhos.set(CABECALHO_DO_CODIGO, codigo);
  cabecalhos.set(CABECALHO_DE_CRIAR, criar ? "1" : "0");
  return env.SALAS.get(env.SALAS.idFromName(codigo)).fetch(new Request(pedido, { headers: cabecalhos }));
}

export default {
  async fetch(pedido: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(pedido.url);
    // Um IP martelando o relay é barrado aqui, antes de acordar os Durable Objects.
    const ip = pedido.headers.get("CF-Connecting-IP") ?? "";
    if (env.LIMITE_POR_IP && ip && !(await env.LIMITE_POR_IP.limit({ key: ip })).success) return new Response("Muitos pedidos.", { status: 429 });

    if (pathname === "/criar") {
      for (let i = 0; i < TENTATIVAS_DE_CODIGO; i++) {
        const resposta = await encaminhar(pedido, env, gerarCodigo(Math.random), true);
        if (resposta.status !== CODIGO_EM_USO) return resposta;
      }
      return new Response("Não consegui sortear um código livre.", { status: 503 });
    }

    // O app web roda em outro domínio: a lista precisa liberar CORS.
    if (pathname === "/salas") {
      return Response.json(await diretorio(env).listar(), { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } });
    }

    if (pathname === "/presenca") {
      const autenticado = await comPessoa(pedido, env);
      if (!autenticado) return new Response("Ficha inválida.", { status: 401 });
      return env.PRESENCA.get(env.PRESENCA.idFromName("presenca")).fetch(autenticado.pedido);
    }

    if (pathname === "/chat/moderacao") return avisoDeModeracao(pedido, env);

    if (pathname === "/chat") {
      const autenticado = await comPessoa(pedido, env);
      if (!autenticado) return new Response("Ficha inválida.", { status: 401 });
      return env.CHAT.get(env.CHAT.idFromName("chat")).fetch(autenticado.pedido);
    }

    const transmissao = /^\/transmissao\/([0-9a-f-]{36})$/.exec(pathname);
    if (transmissao) {
      const sem = new Headers(pedido.headers);
      sem.delete(CABECALHO_DA_PESSOA);
      const destino = env.TRANSMISSOES.get(env.TRANSMISSOES.idFromName(transmissao[1]));
      if (!fichaDoPedido(pedido).ficha) return destino.fetch(new Request(pedido, { headers: sem }));
      // Só a própria pessoa transmite a partida dela.
      const autenticado = await comPessoa(pedido, env);
      if (!autenticado || autenticado.pessoa.id !== transmissao[1]) return new Response("Ficha inválida.", { status: 401 });
      return destino.fetch(autenticado.pedido);
    }

    const sala = /^\/sala\/([^/]+)$/.exec(pathname);
    if (sala && codigoValido(sala[1])) return encaminhar(pedido, env, sala[1], false);

    return new Response("Riff Rush relay", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
