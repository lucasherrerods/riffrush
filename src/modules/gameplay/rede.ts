/** O resumo da partida que cada jogador manda para a sala, várias vezes por segundo. */
export interface EstadoDoJogador {
  pontos: number;
  vida: number;
  sequencia: number;
  /** Quantidade de acertos; o chibi do adversário palheta quando muda. */
  pulso: number;
  derrota: boolean;
  /** A vida zerou em algum momento: segue tocando, mas com a marca de fantasma. */
  fantasma?: boolean;
  terminou: boolean;
}
