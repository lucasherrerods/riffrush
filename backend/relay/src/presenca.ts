// Partes puras da lista de quem está online e da transmissão ao vivo das partidas.

import { TAMANHO_MAXIMO_DA_MENSAGEM } from "./regras";

export interface Pessoa {
  id: string;
  nome: string;
  avatar: string | null;
}

/** Quem a ficha diz que é, com o nível da conta (o chat global só deixa escrever a partir de um nível). */
export type PessoaDaFicha = Pessoa & { nivel: number };

/**
 * O app manda a ficha como subprotocolo do WebSocket (`new WebSocket(url, [PROTOCOLO_DO_JOGO, ficha])`):
 * assim ela não aparece na URL, que acaba em logs. A resposta precisa devolver PROTOCOLO_DO_JOGO.
 */
export const PROTOCOLO_DO_JOGO = "riffrush";

export function fichaDoPedido(pedido: Request): { ficha: string; peloProtocolo: boolean } {
  const protocolos = (pedido.headers.get("Sec-WebSocket-Protocol") ?? "").split(",").map((p) => p.trim());
  if (protocolos.includes(PROTOCOLO_DO_JOGO)) {
    const ficha = protocolos.find((p) => p && p !== PROTOCOLO_DO_JOGO);
    if (ficha) return { ficha, peloProtocolo: true };
  }
  return { ficha: new URL(pedido.url).searchParams.get("ficha") ?? "", peloProtocolo: false };
}

/** Onde a pessoa está. A música vai com o id do ranking, para quem assiste achar a mesma. */
export type EstadoOnline =
  | { tipo: "menu" }
  | { tipo: "tocando"; musica: string; titulo: string; artista: string; dificuldade: string; instrumento: string; transmitindo: boolean };

export type PessoaOnline = Pessoa & { estado: EstadoOnline };

/** O que o relay manda para quem está na lista. */
export type MensagemDaPresenca = { tipo: "lista"; pessoas: PessoaOnline[] } | { tipo: "pessoa"; pessoa: PessoaOnline } | { tipo: "saiu"; id: string };

const TAMANHO_MAXIMO_DO_TEXTO = 80;
const ID_DA_MUSICA_MAXIMO = 200;

const decodificarBase64Url = (texto: string) => Uint8Array.from(atob(texto.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

/**
 * Confere a ficha que a API assinou (`base64url(json).base64url(hmac-sha256)`) e devolve quem é.
 * Sem segredo configurado, ninguém entra.
 */
export async function verificarFicha(ficha: string, segredo: string, agoraEmSegundos: number): Promise<PessoaDaFicha | null> {
  const [corpo, assinatura, sobra] = ficha.split(".");
  if (!segredo || !corpo || !assinatura || sobra !== undefined) return null;
  try {
    const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    if (!(await crypto.subtle.verify("HMAC", chave, decodificarBase64Url(assinatura), new TextEncoder().encode(corpo)))) return null;
    const dados = JSON.parse(new TextDecoder().decode(decodificarBase64Url(corpo)));
    if (typeof dados?.id !== "string" || typeof dados.nome !== "string" || typeof dados.exp !== "number" || dados.exp < agoraEmSegundos) return null;
    const nivel = Number.isInteger(dados.nivel) && dados.nivel > 0 ? dados.nivel : 0;
    return { id: dados.id, nome: dados.nome.slice(0, TAMANHO_MAXIMO_DO_TEXTO), avatar: typeof dados.avatar === "string" ? dados.avatar : null, nivel };
  } catch {
    return null;
  }
}

const texto = (valor: unknown, maximo = TAMANHO_MAXIMO_DO_TEXTO) => (typeof valor === "string" ? valor.slice(0, maximo) : null);

/** O estado vem do app: só passa o formato conhecido, com os textos cortados. */
export function lerEstado(valor: unknown): EstadoOnline | null {
  const estado = valor as Record<string, unknown> | null;
  if (estado?.tipo === "menu") return { tipo: "menu" };
  if (estado?.tipo !== "tocando") return null;
  const musica = texto(estado.musica, ID_DA_MUSICA_MAXIMO);
  const titulo = texto(estado.titulo);
  const artista = texto(estado.artista);
  const dificuldade = texto(estado.dificuldade, 20);
  const instrumento = texto(estado.instrumento, 20);
  if (musica === null || titulo === null || artista === null || dificuldade === null || instrumento === null) return null;
  return { tipo: "tocando", musica, titulo, artista, dificuldade, instrumento, transmitindo: estado.transmitindo === true };
}

/** O início de uma partida transmitida: o que quem assiste precisa para montar a mesma partida. */
export interface PartidaTransmitida {
  musica: string;
  dificuldade: string;
  instrumento: string;
  hashDoChart: string;
  semFalha: boolean;
  /** O .sng da música no Encore, para quem assiste baixar com um clique. */
  urlDoEncore?: string;
}

/** Só o caminho de um chart no servidor de arquivos do Encore, sem nada além disso. */
const CHART_DO_ENCORE = /^https:\/\/files\.enchor\.us\/(?:charts\/v\d{1,3}\/)?([0-9a-f]{32})(?:_novideo)?\.sng$/;

/** O link só vale se for um chart do Encore e da mesma música que está sendo tocada. */
export function linkDoChartConfere(url: unknown, musica: string): url is string {
  if (typeof url !== "string") return false;
  const md5 = CHART_DO_ENCORE.exec(url)?.[1];
  return !!md5 && musica === `encore:${md5}`;
}

/**
 * Cada entrada é `[tempo em ms, código]`: código 0 a 4 aperta a pista, 5 a 9 solta, 10 ativa o star power.
 * `ate` é até onde a partida de quem joga já chegou, em segundos.
 */
export type MensagemDaTransmissao =
  | { tipo: "inicio"; partida: PartidaTransmitida }
  | { tipo: "lote"; ate: number; entradas: [number, number][] }
  | { tipo: "pausa"; pausado: boolean }
  | { tipo: "fim" };

const CODIGO_MAXIMO = 10;
/** Um lote por segundo; nem os trechos mais rápidos passam de algumas dezenas de entradas. */
const ENTRADAS_POR_LOTE = 500;

/** Para quem joga: quantas pessoas estão assistindo agora. */
export const avisoDeEspectadores = (quantos: number) => JSON.stringify({ tipo: "espectadores", quantos });

export function lerMensagemDaTransmissao(bruta: string): MensagemDaTransmissao | null {
  if (bruta.length > TAMANHO_MAXIMO_DA_MENSAGEM) return null;
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(bruta);
  } catch {
    return null;
  }
  if (msg?.tipo === "fim") return { tipo: "fim" };
  if (msg?.tipo === "pausa") return { tipo: "pausa", pausado: msg.pausado === true };
  if (msg?.tipo === "lote") {
    const entradas = msg.entradas;
    if (typeof msg.ate !== "number" || !Number.isFinite(msg.ate) || !Array.isArray(entradas) || entradas.length > ENTRADAS_POR_LOTE) return null;
    const validas = entradas.every(
      (e) => Array.isArray(e) && e.length === 2 && Number.isInteger(e[0]) && Number.isInteger(e[1]) && e[1] >= 0 && e[1] <= CODIGO_MAXIMO,
    );
    return validas ? { tipo: "lote", ate: msg.ate, entradas: entradas as [number, number][] } : null;
  }
  if (msg?.tipo === "inicio") {
    const p = msg.partida as Record<string, unknown> | null;
    const musica = texto(p?.musica, ID_DA_MUSICA_MAXIMO);
    const dificuldade = texto(p?.dificuldade, 20);
    const instrumento = texto(p?.instrumento, 20);
    const hash = texto(p?.hashDoChart, 32);
    if (musica === null || dificuldade === null || instrumento === null || hash === null || !/^[0-9a-f]{32}$/.test(hash)) return null;
    const partida: PartidaTransmitida = { musica, dificuldade, instrumento, hashDoChart: hash, semFalha: p?.semFalha === true };
    // Link estranho não derruba a transmissão: só não vai junto.
    if (linkDoChartConfere(p?.urlDoEncore, musica)) partida.urlDoEncore = p.urlDoEncore;
    return { tipo: "inicio", partida };
  }
  return null;
}
