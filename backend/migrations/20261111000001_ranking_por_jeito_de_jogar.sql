-- Cada música passa a ter um top separado por jeito de jogar.
-- As partidas do ranking sem jeito são de antes da opção, quando só existia o gamepad.
UPDATE partidas SET jeito_de_jogar = 'gamepad' WHERE jeito_de_jogar IS NULL AND precisao IS NOT NULL;

ALTER TABLE partidas ADD CONSTRAINT partida_do_ranking_tem_jeito CHECK (precisao IS NULL OR jeito_de_jogar IS NOT NULL);

CREATE INDEX partidas_do_ranking_por_jeito ON partidas (musica_id, dificuldade, instrumento, jeito_de_jogar, conta_id, pontos DESC, jogada_em ASC)
    WHERE precisao IS NOT NULL AND NOT derrota AND NOT fantasma;

-- O recorde de cada jogador em cada jeito de jogar, já com a posição. A retenção dos replays também lê daqui.
CREATE VIEW recordes_por_jeito AS
SELECT melhores.*,
       ROW_NUMBER() OVER (PARTITION BY musica_id, dificuldade, instrumento, jeito_de_jogar ORDER BY pontos DESC, jogada_em ASC) AS posicao,
       COUNT(*) OVER (PARTITION BY musica_id, dificuldade, instrumento, jeito_de_jogar) AS jogadores
FROM (
    SELECT DISTINCT ON (musica_id, dificuldade, instrumento, jeito_de_jogar, conta_id)
           id AS partida_id, conta_id, musica_id, dificuldade, instrumento, jeito_de_jogar, pontos, acertos, total, precisao, maior_sequencia, jogada_em
    FROM partidas
    WHERE precisao IS NOT NULL AND NOT derrota AND NOT fantasma
    ORDER BY musica_id, dificuldade, instrumento, jeito_de_jogar, conta_id, pontos DESC, jogada_em ASC
) AS melhores;
