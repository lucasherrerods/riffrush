/** "1,25x": como a velocidade da música aparece para o jogador. */
export const rotuloDaVelocidade = (velocidade: number) => `${velocidade.toLocaleString("pt-BR")}x`;

/** Tempo real (o da partida) de um instante da música tocada na `velocidade`. */
export const noTempoReal = (tempoDaMusica: number, velocidade: number) => tempoDaMusica / velocidade;
