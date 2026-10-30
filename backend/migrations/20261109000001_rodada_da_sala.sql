-- Numa sala do multijogador cada jogador manda a própria partida. A rodada junta as partidas da
-- mesma música tocada na sala, para as mais jogadas contarem uma vez só. Solo fica sem.
ALTER TABLE partidas ADD COLUMN rodada_id UUID;
ALTER TABLE partidas_pendentes ADD COLUMN rodada_id UUID;

-- As partidas de antes não sabem da sala. Partidas da mesma música, de contas diferentes, com até
-- 30 s entre uma e a próxima foram, quase sempre, a mesma rodada. Grupo com a mesma conta duas vezes
-- ou com uma partida só fica como estava.
WITH ordenadas AS (
    SELECT id, conta_id, musica_id, jogada_em,
           CASE WHEN jogada_em - LAG(jogada_em) OVER (PARTITION BY musica_id ORDER BY jogada_em, id) <= interval '30 seconds'
                THEN 0 ELSE 1 END AS comeca_grupo
    FROM partidas
),
agrupadas AS (
    SELECT id, conta_id, musica_id,
           SUM(comeca_grupo) OVER (PARTITION BY musica_id ORDER BY jogada_em, id) AS grupo
    FROM ordenadas
),
rodadas AS (
    SELECT musica_id, grupo, md5(musica_id || '|' || grupo)::uuid AS rodada_id
    FROM agrupadas
    GROUP BY musica_id, grupo
    HAVING COUNT(*) > 1 AND COUNT(*) = COUNT(DISTINCT conta_id)
)
UPDATE partidas p
SET rodada_id = r.rodada_id
FROM agrupadas a
JOIN rodadas r ON r.musica_id = a.musica_id AND r.grupo = a.grupo
WHERE p.id = a.id;
