-- As regras do Clone Hero: pontos, precisão e full combo mudam, e a velocidade da música deixa de multiplicar os pontos.
-- Cada partida passa a guardar com que regras e em que velocidade foi julgada, e o ranking separa as velocidades.
ALTER TABLE partidas ADD COLUMN velocidade DOUBLE PRECISION;
-- 2: regras do Clone Hero. NULL: regras antigas, à espera de o servidor rejulgar o replay. 1: antigas sem como rejulgar.
ALTER TABLE partidas ADD COLUMN regras SMALLINT;

-- Sem replay (ou fora do ranking) não há como rejulgar: a partida fica com as regras antigas, fora do ranking.
UPDATE partidas SET regras = 1 WHERE replay IS NULL OR precisao IS NULL OR musica_id NOT LIKE 'encore:%';

CREATE INDEX partidas_a_rejulgar ON partidas (jogada_em) WHERE regras IS NULL;

DROP VIEW recordes_por_jeito;
DROP VIEW recordes_do_ranking;
DROP INDEX partidas_do_ranking_por_jeito;

CREATE INDEX partidas_do_ranking_por_velocidade ON partidas (musica_id, dificuldade, instrumento, jeito_de_jogar, velocidade, conta_id, pontos DESC, jogada_em ASC)
    WHERE regras = 2 AND precisao IS NOT NULL AND NOT derrota AND NOT fantasma;

-- O recorde de cada jogador em cada jeito de jogar e velocidade, já com a posição. A retenção dos replays também lê daqui.
CREATE VIEW recordes_por_jeito AS
SELECT melhores.*,
       ROW_NUMBER() OVER (PARTITION BY musica_id, dificuldade, instrumento, jeito_de_jogar, velocidade ORDER BY pontos DESC, jogada_em ASC) AS posicao,
       COUNT(*) OVER (PARTITION BY musica_id, dificuldade, instrumento, jeito_de_jogar, velocidade) AS jogadores
FROM (
    SELECT DISTINCT ON (musica_id, dificuldade, instrumento, jeito_de_jogar, velocidade, conta_id)
           id AS partida_id, conta_id, musica_id, dificuldade, instrumento, jeito_de_jogar, velocidade, pontos, acertos, total, precisao, maior_sequencia, jogada_em
    FROM partidas
    WHERE regras = 2 AND precisao IS NOT NULL AND NOT derrota AND NOT fantasma
    ORDER BY musica_id, dificuldade, instrumento, jeito_de_jogar, velocidade, conta_id, pontos DESC, jogada_em ASC
) AS melhores;

-- O recorde de cada música na velocidade normal, em qualquer jeito de jogar: o primeiro lugar das mais jogadas.
CREATE VIEW recordes_do_ranking AS
SELECT melhores.*,
       ROW_NUMBER() OVER (PARTITION BY musica_id, dificuldade, instrumento ORDER BY pontos DESC, jogada_em ASC) AS posicao,
       COUNT(*) OVER (PARTITION BY musica_id, dificuldade, instrumento) AS jogadores
FROM (
    SELECT DISTINCT ON (musica_id, dificuldade, instrumento, conta_id)
           id AS partida_id, conta_id, musica_id, dificuldade, instrumento, pontos, acertos, total, precisao, maior_sequencia, jogada_em, jeito_de_jogar
    FROM partidas
    WHERE regras = 2 AND velocidade = 1 AND precisao IS NOT NULL AND NOT derrota AND NOT fantasma
    ORDER BY musica_id, dificuldade, instrumento, conta_id, pontos DESC, jogada_em ASC
) AS melhores;
