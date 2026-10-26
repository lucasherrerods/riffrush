-- Partidas de charts do Encore esperando o servidor rejulgar o replay. Ficam aqui até o chart
-- ser baixado e a partida virar uma linha de `partidas`; o Encore fora do ar só atrasa, não perde nada.
CREATE TABLE partidas_pendentes (
    -- Vira o id da partida: reprocessar depois de uma queda não registra duas vezes.
    id UUID PRIMARY KEY,
    conta_id UUID NOT NULL REFERENCES contas (id) ON DELETE CASCADE,
    md5 TEXT NOT NULL,
    dificuldade TEXT NOT NULL,
    instrumento TEXT NOT NULL,
    replay BYTEA NOT NULL,
    enviada_em TIMESTAMPTZ NOT NULL,
    tentativas INTEGER NOT NULL DEFAULT 0,
    tentar_em TIMESTAMPTZ NOT NULL,
    -- Preenchido quando a partida não tem como valer (replay de outro chart, chart sumiu do Encore).
    desistiu_por TEXT
);

CREATE INDEX partidas_pendentes_na_vez ON partidas_pendentes (tentar_em) WHERE desistiu_por IS NULL;
CREATE INDEX partidas_pendentes_por_conta ON partidas_pendentes (conta_id, enviada_em DESC);

-- Só o chart e o atraso de cada .sng já baixado: poucos KB, sem o áudio.
CREATE TABLE charts_do_encore (
    md5 TEXT PRIMARY KEY,
    arquivo BYTEA NOT NULL,
    midi BOOLEAN NOT NULL,
    atraso_ms DOUBLE PRECISION NOT NULL,
    baixado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
