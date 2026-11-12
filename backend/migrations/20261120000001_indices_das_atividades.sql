-- O log de atividades lê as partidas e as contas mais recentes de todo mundo.
CREATE INDEX partidas_por_data ON partidas (jogada_em DESC);
CREATE INDEX partidas_do_mania_por_data ON partidas_do_mania (jogada_em DESC);
CREATE INDEX contas_por_criacao ON contas (criada_em DESC);
