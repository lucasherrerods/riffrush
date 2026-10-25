-- O ranking geral lê o top e conta quem está à frente pelo índice, sem numerar todas as contas.
CREATE INDEX contas_por_xp ON contas (xp_total DESC, criada_em) WHERE xp_total > 0;
