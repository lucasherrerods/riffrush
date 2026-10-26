-- O ranking de cada música passa a ser por pontos (calculados pelo servidor ao rejulgar o replay),
-- e no empate fica quem chegou primeiro. Continuam de fora as partidas que o servidor não conferiu
-- (sem precisão), as vaiadas e as de fantasma.
CREATE OR REPLACE VIEW recordes_do_ranking AS
SELECT melhores.*,
       ROW_NUMBER() OVER (PARTITION BY musica_id, dificuldade, instrumento ORDER BY pontos DESC, jogada_em ASC) AS posicao,
       COUNT(*) OVER (PARTITION BY musica_id, dificuldade, instrumento) AS jogadores
FROM (
    SELECT DISTINCT ON (musica_id, dificuldade, instrumento, conta_id)
           id AS partida_id, conta_id, musica_id, dificuldade, instrumento, pontos, acertos, total, precisao, maior_sequencia, jogada_em
    FROM partidas
    WHERE precisao IS NOT NULL AND NOT derrota AND NOT fantasma
    ORDER BY musica_id, dificuldade, instrumento, conta_id, pontos DESC, jogada_em ASC
) AS melhores;
