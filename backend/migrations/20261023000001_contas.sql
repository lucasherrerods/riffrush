CREATE TABLE contas (
    id UUID PRIMARY KEY,
    google_sub TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    avatar TEXT,
    xp_total BIGINT NOT NULL DEFAULT 0,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessoes (
    token_hash TEXT PRIMARY KEY,
    conta_id UUID NOT NULL REFERENCES contas (id) ON DELETE CASCADE,
    expira_em TIMESTAMPTZ NOT NULL
);

CREATE INDEX sessoes_por_conta ON sessoes (conta_id);

CREATE TABLE partidas (
    id UUID PRIMARY KEY,
    conta_id UUID NOT NULL REFERENCES contas (id) ON DELETE CASCADE,
    musica_id TEXT NOT NULL,
    dificuldade TEXT NOT NULL,
    pontos BIGINT NOT NULL,
    acertos INTEGER NOT NULL,
    total INTEGER NOT NULL,
    derrota BOOLEAN NOT NULL,
    fantasma BOOLEAN NOT NULL,
    xp_ganho BIGINT NOT NULL,
    jogada_em TIMESTAMPTZ NOT NULL
);

CREATE INDEX partidas_por_conta ON partidas (conta_id, jogada_em DESC);
