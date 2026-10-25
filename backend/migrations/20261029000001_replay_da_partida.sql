-- Só a melhor partida de cada jogador em cada música guarda o replay (poucos KB cada).
ALTER TABLE partidas ADD COLUMN replay BYTEA;
