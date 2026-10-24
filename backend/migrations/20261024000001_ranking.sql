-- O ranking busca a melhor partida de cada jogador por música e dificuldade.
CREATE INDEX partidas_por_musica ON partidas (musica_id, dificuldade, conta_id, pontos DESC);
