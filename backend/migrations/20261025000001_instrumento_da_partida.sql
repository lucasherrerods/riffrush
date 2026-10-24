-- Cada instrumento do chart (guitarra, baixo, rítmica...) tem o próprio ranking.
-- As partidas de antes eram todas na guitarra.
ALTER TABLE partidas ADD COLUMN instrumento TEXT NOT NULL DEFAULT 'guitarra';

DROP INDEX partidas_por_musica;
CREATE INDEX partidas_por_musica ON partidas (musica_id, dificuldade, instrumento, conta_id, pontos DESC);
