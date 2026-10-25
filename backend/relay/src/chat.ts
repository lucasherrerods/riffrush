// Partes puras do chat global. As regras são as mesmas de frontend/src/modules/chat/chat.ts:
// o relay é publicado à parte e não importa o app, então os dois lados precisam andar juntos.

export const TAMANHO_MAXIMO_DO_TEXTO = 200;
export const MENSAGENS_GUARDADAS = 50;
/** Mensagens mais velhas que isso não aparecem nem ficam guardadas. */
export const RETENCAO_MS = 24 * 60 * 60 * 1000;
/** Conta nova não escreve: criar contas em massa para spam fica caro. */
export const NIVEL_PARA_ESCREVER = 2;
/** Folga para o JSON e para textos com acentos escapados. */
const TAMANHO_MAXIMO_DA_MENSAGEM = 2048;
const RAJADA = 5;
const RECARGA_MS = 1000;

const INVISIVEIS = /[\p{Cc}\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/gu;

/** Quem escreveu, como os outros veem. O id da conta serve para silenciar e para a moderação. */
export interface Autor {
  id: string;
  nome: string;
  /** Selo "Equipe": só quem a API marcou como equipe na ficha. */
  equipe?: true;
}

export interface MensagemDoChat {
  n: number;
  autor: Autor;
  texto: string;
  /** Hora de chegada no relay, em ms. */
  em: number;
}

/** O que a pessoa pode fazer, mandado ao entrar e quando muda. */
export interface Permissoes {
  podeEscrever: boolean;
  admin: boolean;
  banido: boolean;
  nivelParaEscrever: number;
}

export type MensagemDoChatGlobal =
  | { tipo: "historico"; mensagens: MensagemDoChat[]; voce: Permissoes }
  | { tipo: "mensagem"; mensagem: MensagemDoChat }
  | { tipo: "apagadas"; ns: number[] }
  | { tipo: "voce"; voce: Permissoes };

export type Comando =
  | { tipo: "mensagem"; texto: string }
  | { tipo: "denunciar"; n: number }
  | { tipo: "apagar"; n: number };

/** O que a API avisa quando a equipe bane ou desbane alguém (as denúncias e os banidos ficam no banco). */
export type AvisoDaApi = { tipo: "banir" | "desbanir"; id: string };

const ID_DA_CONTA = /^[0-9a-f-]{36}$/;

export function lerAvisoDaApi(corpo: string): AvisoDaApi | null {
  try {
    const { tipo, id } = JSON.parse(corpo) as Record<string, unknown>;
    return (tipo === "banir" || tipo === "desbanir") && typeof id === "string" && ID_DA_CONTA.test(id) ? { tipo, id } : null;
  } catch {
    return null;
  }
}

/** O texto que o app mandou (`{"texto": "..."}`), limpo, ou null quando não é uma mensagem de chat. */
export function lerTextoDoChat(bruta: string): string | null {
  const comando = lerComando(bruta);
  return comando?.tipo === "mensagem" ? comando.texto : null;
}

/** O que o app pediu, conferido. Sem `tipo`, é uma mensagem (como mandavam as versões antigas). */
export function lerComando(bruta: string): Comando | null {
  if (bruta.length > TAMANHO_MAXIMO_DA_MENSAGEM) return null;
  let dados: Record<string, unknown>;
  try {
    dados = JSON.parse(bruta);
  } catch {
    return null;
  }
  if (!dados || typeof dados !== "object") return null;
  const tipo = dados.tipo ?? "mensagem";
  if (tipo === "mensagem") {
    const texto = limparTexto(dados.texto);
    return texto ? { tipo, texto } : null;
  }
  if ((tipo === "denunciar" || tipo === "apagar") && Number.isInteger(dados.n) && (dados.n as number) > 0) return { tipo, n: dados.n as number };
  return null;
}

function limparTexto(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  const limpo = texto
    .replace(/[\t\n\r]/g, " ")
    .replace(INVISIVEIS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TAMANHO_MAXIMO_DO_TEXTO)
    .trim();
  return limpo || null;
}

export interface Balde {
  fichas: number;
  em: number;
}

export const BALDE_CHEIO: Balde = { fichas: RAJADA, em: -Infinity };

/** Rajada de 5 mensagens, depois uma por segundo, por conta. */
export function gastarDoBalde(balde: Balde, agora: number): { passa: boolean; balde: Balde } {
  const recarregadas = balde.em === -Infinity ? RAJADA : Math.floor((agora - balde.em) / RECARGA_MS);
  const fichas = Math.min(RAJADA, balde.fichas + recarregadas);
  const em = balde.em === -Infinity || fichas === RAJADA ? agora : balde.em + recarregadas * RECARGA_MS;
  if (fichas < 1) return { passa: false, balde: { fichas, em } };
  return { passa: true, balde: { fichas: fichas - 1, em } };
}

/** Chaves com zeros à esquerda: a listagem do storage sai em ordem de chegada. */
export const chaveDaMensagem = (n: number) => `msg:${String(n).padStart(8, "0")}`;

export const podeEscrever = (p: { nivel: number; admin: boolean; banido: boolean }) => p.admin || (!p.banido && p.nivel >= NIVEL_PARA_ESCREVER);

const RESERVADOS = ["equipe", "admin", "moderador", "moderacao", "suporte", "staff", "oficial", "riffrush"];
const TROCAS: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };

/** O nome vem do Google e é livre: quem não é da equipe e usa um nome que parece oficial ganha o aviso. */
export function nomeParaMostrar(nome: string, admin: boolean): string {
  if (admin) return nome;
  const comparavel = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[0-9@$]/g, (c) => TROCAS[c] ?? c)
    .replace(/[^a-z]/g, "");
  return RESERVADOS.some((r) => comparavel.includes(r)) ? `${nome} (não oficial)` : nome;
}

export const recentes = (mensagens: MensagemDoChat[], agora: number) => mensagens.filter((m) => agora - m.em <= RETENCAO_MS);
