-- Precisão pelo valor de cada nota (Perfeito 300, Ótimo 100, Bom 50), calculada pelo servidor ao rejulgar o replay.
-- As partidas antigas e as de charts que o servidor não confere ficam sem, e fora do ranking.
ALTER TABLE partidas ADD COLUMN precisao DOUBLE PRECISION;

CREATE INDEX partidas_do_ranking ON partidas (musica_id, dificuldade, instrumento, conta_id, precisao DESC)
    WHERE precisao IS NOT NULL;

-- O recorde de cada jogador em cada música, dificuldade e instrumento, já com a posição.
-- Ordem: maior precisão, depois maior sequência, depois quem chegou primeiro.
-- O ranking lê daqui e o registro de partidas usa para decidir quais replays guardar.
CREATE VIEW recordes_do_ranking AS
SELECT melhores.*,
       ROW_NUMBER() OVER (PARTITION BY musica_id, dificuldade, instrumento
                          ORDER BY precisao DESC, maior_sequencia DESC NULLS LAST, jogada_em ASC) AS posicao,
       COUNT(*) OVER (PARTITION BY musica_id, dificuldade, instrumento) AS jogadores
FROM (
    SELECT DISTINCT ON (musica_id, dificuldade, instrumento, conta_id)
           id AS partida_id, conta_id, musica_id, dificuldade, instrumento, pontos, acertos, total, precisao, maior_sequencia, jogada_em
    FROM partidas
    WHERE precisao IS NOT NULL AND NOT derrota AND NOT fantasma
    ORDER BY musica_id, dificuldade, instrumento, conta_id, precisao DESC, maior_sequencia DESC NULLS LAST, jogada_em ASC
) AS melhores;
