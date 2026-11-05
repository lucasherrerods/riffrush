-- Os replays do Mania saem da tabela das partidas: só o top 10 de cada mapa guarda o seu,
-- e as consultas do ranking e do perfil não arrastam os bytes junto.
CREATE TABLE replays_do_mania (
    partida_id UUID PRIMARY KEY REFERENCES partidas_do_mania (id) ON DELETE CASCADE,
    replay BYTEA NOT NULL
);

-- Leva os replays do top 10 atual (o melhor de cada conta em cada mapa) e descarta o resto.
INSERT INTO replays_do_mania (partida_id, replay)
SELECT id, replay FROM (
    SELECT id, replay, row_number() OVER (PARTITION BY beatmap_id ORDER BY pontuacao DESC, jogada_em ASC) AS posicao
    FROM (
        SELECT DISTINCT ON (beatmap_id, conta_id) id, beatmap_id, replay, pontuacao, jogada_em
        FROM partidas_do_mania
        WHERE vale_ranking
        ORDER BY beatmap_id, conta_id, pontuacao DESC, jogada_em ASC
    ) melhores
) posicoes
WHERE posicao <= 10 AND replay IS NOT NULL;

ALTER TABLE partidas_do_mania DROP COLUMN replay;

-- Para contar as partidas de cada mapa no leaderboard dos mapas mais jogados.
CREATE INDEX partidas_do_mania_por_mapa ON partidas_do_mania (beatmap_id) WHERE vale_ranking;
