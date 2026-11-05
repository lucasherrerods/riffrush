import { elevacaoDoAro, forcaDaChama } from "./pista/efeitos";

/** A abertura da partida, em segundos desde o começo da contagem. */
export const ABERTURA = {
  /** A pista sobe de baixo da tela. */
  atrasoDaPista: 0.4,
  duracaoDaPista: 1.4,
  /** O amplificador e o medidor entram, cada um do seu lado, quando a pista está quase no lugar. */
  atrasoDoHud: 1.3,
  duracaoDoHud: 0.8,
  /** Os trastes são teclados um de cada vez, da esquerda para a direita. */
  atrasoDosTrastes: 2,
  passoDosTrastes: 0.22,
};

/** Quanto da altura da tela falta para a pista chegar ao lugar (1 a 0), freando no fim. */
export function descidaDaPista(desdeOInicio: number) {
  const k = (desdeOInicio - ABERTURA.atrasoDaPista) / ABERTURA.duracaoDaPista;
  if (k <= 0) return 1;
  if (k >= 1) return 0;
  return (1 - k) ** 3;
}

/** Elevação e chama de um traste enquanto ele é teclado na abertura. */
export function teclaDaAbertura(desdeOInicio: number, traste: number) {
  const idade = desdeOInicio - ABERTURA.atrasoDosTrastes - traste * ABERTURA.passoDosTrastes;
  return { elevacao: elevacaoDoAro(idade), chama: forcaDaChama(idade) * 0.6 };
}

/** Do começo até o último traste baixar. */
const DURACAO_DA_ABERTURA = ABERTURA.atrasoDosTrastes + 4 * ABERTURA.passoDosTrastes + 0.3;
/** Um intervalo maior que este entre dois quadros quer dizer que a tela ainda está travada carregando. */
const QUADRO_TRAVADO_MS = 100;

/** A abertura espera a entrada sair da frente e a tela parar de travar, para ser vista inteira. */
export function aberturaPodeComecar(esperandoEntrada: boolean, msDesdeOQuadroAnterior: number) {
  return !esperandoEntrada && msDesdeOQuadroAnterior <= QUADRO_TRAVADO_MS;
}

/** Se a espera comeu parte da contagem, a abertura anda mais rápido para terminar antes da música. */
export function ritmoDaAbertura(segundosAteAMusica: number) {
  return Math.max(1, DURACAO_DA_ABERTURA / segundosAteAMusica);
}
