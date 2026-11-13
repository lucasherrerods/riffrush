-- Tapping e gamepad passam a disputar o mesmo ranking: o gamepad só compensa a velocidade do controle.
-- A palhetada continua com o próprio. O grupo é o mesmo de `JeitoDeJogar::grupo_do_ranking`.
DROP VIEW recordes_por_jeito;
DROP INDEX partidas_do_ranking_por_velocidade;

CREATE FUNCTION grupo_do_ranking(jeito TEXT) RETURNS TEXT
    LANGUAGE SQL IMMUTABLE PARALLEL SAFE
    AS $$ SELECT CASE WHEN jeito = 'palhetada' THEN 'palhetada' ELSE 'trastes' END $$;

CREATE INDEX partidas_do_ranking_por_grupo ON partidas (musica_id, dificuldade, instrumento, grupo_do_ranking(jeito_de_jogar), velocidade, conta_id, pontos DESC, jogada_em ASC)
    WHERE regras = 2 AND precisao IS NOT NULL AND NOT derrota AND NOT fantasma;

-- O recorde de cada jogador em cada grupo e velocidade, já com a posição. `jeito_de_jogar` é o da partida do recorde.
-- A retenção dos replays também lê daqui.
CREATE VIEW recordes_por_jeito AS
SELECT melhores.*,
       ROW_NUMBER() OVER (PARTITION BY musica_id, dificuldade, instrumento, grupo, velocidade ORDER BY pontos DESC, jogada_em ASC) AS posicao,
       COUNT(*) OVER (PARTITION BY musica_id, dificuldade, instrumento, grupo, velocidade) AS jogadores
FROM (
    SELECT DISTINCT ON (musica_id, dificuldade, instrumento, grupo_do_ranking(jeito_de_jogar), velocidade, conta_id)
           id AS partida_id, conta_id, musica_id, dificuldade, instrumento, jeito_de_jogar, grupo_do_ranking(jeito_de_jogar) AS grupo,
           velocidade, pontos, acertos, total, precisao, maior_sequencia, jogada_em
    FROM partidas
    WHERE regras = 2 AND precisao IS NOT NULL AND NOT derrota AND NOT fantasma
    ORDER BY musica_id, dificuldade, instrumento, grupo_do_ranking(jeito_de_jogar), velocidade, conta_id, pontos DESC, jogada_em ASC
) AS melhores;
