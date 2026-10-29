-- O jeito de jogar (tapping, gamepad ou palhetada) de cada partida que o servidor rejulgou, lido do replay.
-- As outras partidas, e as de antes desta migração, ficam sem: o ranking mostra o jeito só quando sabe.
ALTER TABLE partidas ADD COLUMN jeito_de_jogar TEXT CHECK (jeito_de_jogar IN ('tapping', 'gamepad', 'palhetada'));

-- A view ganha a coluna no meio, então precisa ser recriada.
DROP VIEW recordes_do_ranking;
CREATE VIEW recordes_do_ranking AS
SELECT melhores.*,
       ROW_NUMBER() OVER (PARTITION BY musica_id, dificuldade, instrumento ORDER BY pontos DESC, jogada_em ASC) AS posicao,
       COUNT(*) OVER (PARTITION BY musica_id, dificuldade, instrumento) AS jogadores
FROM (
    SELECT DISTINCT ON (musica_id, dificuldade, instrumento, conta_id)
           id AS partida_id, conta_id, musica_id, dificuldade, instrumento, pontos, acertos, total, precisao, maior_sequencia, jogada_em, jeito_de_jogar
    FROM partidas
    WHERE precisao IS NOT NULL AND NOT derrota AND NOT fantasma
    ORDER BY musica_id, dificuldade, instrumento, conta_id, pontos DESC, jogada_em ASC
) AS melhores;
