-- As partidas do Encore julgadas antes do ScoreV1 passam para ele: a API rejulga as que têm replay,
-- estima as que não têm e refaz o XP de cada uma e o total da conta, aos poucos, em segundo plano.
-- 1: julgada antes do ScoreV1, à espera. 2: no ScoreV1.
ALTER TABLE partidas ADD COLUMN julgamento SMALLINT NOT NULL DEFAULT 2;
-- A precisão saiu da estimativa, não de rejulgar o replay.
ALTER TABLE partidas ADD COLUMN precisao_estimada BOOLEAN NOT NULL DEFAULT false;

UPDATE partidas SET julgamento = 1 WHERE musica_id LIKE 'encore:%';

CREATE INDEX partidas_do_julgamento_antigo ON partidas (jogada_em) WHERE julgamento = 1;
