// Partes puras do relay: o mesmo contrato do servidor da LAN (src-tauri/src/lan),
// para o cliente do jogo não saber se está numa sala da rede ou da internet.

/** Igual a MAXIMO_DE_JOGADORES do protocolo do jogo: o relay é publicado à parte e não importa o app. */
export const MAXIMO_DE_JOGADORES = 4;
/** Quem cria a sala entra primeiro e recebe o id 1. Quando ele sai, a sala fecha. */
export const HOST = 1;
/** Folga para o placar (1/s), as mensagens de lobby e algum pico. */
export const LIMITE_DE_MENSAGENS_POR_SEGUNDO = 20;
/** A maior mensagem do jogo é a lista da sala, bem abaixo disso. */
export const TAMANHO_MAXIMO_DA_MENSAGEM = 8 * 1024;

const SERVIDOR = 0;
const TAMANHO_DO_CODIGO = 5;
/** Sem I, O, L, 0 e 1, que se confundem ao ditar o código. */
const LETRAS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const FORMATO_DO_CODIGO = new RegExp(`^[${LETRAS}]{${TAMANHO_DO_CODIGO}}$`);

export function gerarCodigo(aleatorio: () => number): string {
  return Array.from({ length: TAMANHO_DO_CODIGO }, () => LETRAS[Math.floor(aleatorio() * LETRAS.length)]).join("");
}

export const codigoValido = (codigo: string) => FORMATO_DO_CODIGO.test(codigo);

/** Embrulha a mensagem de um jogador para repassar a todos: `{"de": id, "msg": ...}`. */
export function embrulhar(de: number, mensagem: string): string | null {
  if (mensagem.length > TAMANHO_MAXIMO_DA_MENSAGEM) return null;
  try {
    JSON.parse(mensagem);
  } catch {
    return null;
  }
  return `{"de":${de},"msg":${mensagem}}`;
}

export type MensagemDoServidor = { tipo: "bemVindo"; id: number; codigo: string } | { tipo: "cheia" } | { tipo: "semSala" } | { tipo: "saiu" };

export const mensagemDoServidor = (msg: MensagemDoServidor, de = SERVIDOR) => JSON.stringify({ de, msg });

export interface Janela {
  inicio: number;
  contagem: number;
}

/** Limite por conexão, em janelas de 1 s, para um cliente não gastar a cota do relay sozinho. */
export function dentroDoLimite(janela: Janela, agora: number): { passa: boolean; janela: Janela } {
  if (agora - janela.inicio >= 1000) return { passa: true, janela: { inicio: agora, contagem: 1 } };
  if (janela.contagem >= LIMITE_DE_MENSAGENS_POR_SEGUNDO) return { passa: false, janela };
  return { passa: true, janela: { ...janela, contagem: janela.contagem + 1 } };
}
