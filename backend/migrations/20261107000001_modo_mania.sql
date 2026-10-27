-- O Riff Rush Mania: partidas dos mapas do osu!mania, com fila, cache dos .osu e ranking próprios, separados do Rock.

-- Partidas esperando o servidor rejulgar o replay contra o .osu.
CREATE TABLE partidas_do_mania_pendentes (
    -- Vira o id da partida: reprocessar depois de uma queda não registra duas vezes.
    id UUID PRIMARY KEY,
    conta_id UUID NOT NULL REFERENCES contas (id) ON DELETE CASCADE,
    beatmap_id BIGINT NOT NULL,
    replay BYTEA NOT NULL,
    enviada_em TIMESTAMPTZ NOT NULL,
    tentativas INTEGER NOT NULL DEFAULT 0,
    tentar_em TIMESTAMPTZ NOT NULL,
    -- Preenchido quando a partida não tem como valer (replay de outro mapa, mapa que não é mania).
    desistiu_por TEXT
);

CREATE INDEX partidas_do_mania_pendentes_na_vez ON partidas_do_mania_pendentes (tentar_em) WHERE desistiu_por IS NULL;
CREATE INDEX partidas_do_mania_pendentes_por_conta ON partidas_do_mania_pendentes (conta_id, enviada_em DESC);

-- As partidas rejulgadas. Os números saem do replay, não do app.
CREATE TABLE partidas_do_mania (
    id UUID PRIMARY KEY,
    conta_id UUID NOT NULL REFERENCES contas (id) ON DELETE CASCADE,
    beatmap_id BIGINT NOT NULL,
    beatmapset_id BIGINT,
    pontuacao INTEGER NOT NULL,
    precisao DOUBLE PRECISION NOT NULL,
    -- De MAX a Miss.
    contagem INTEGER[] NOT NULL,
    maior_combo INTEGER NOT NULL,
    derrota BOOLEAN NOT NULL,
    mods INTEGER NOT NULL,
    xp_ganho BIGINT NOT NULL,
    vale_ranking BOOLEAN NOT NULL,
    -- Só das partidas que entram no ranking, para quem quiser assistir.
    replay BYTEA,
    jogada_em TIMESTAMPTZ NOT NULL
);

CREATE INDEX partidas_do_mania_do_ranking ON partidas_do_mania (beatmap_id, pontuacao DESC, jogada_em) WHERE vale_ranking;
CREATE INDEX partidas_do_mania_por_conta ON partidas_do_mania (conta_id, beatmap_id, jogada_em DESC);

-- Os .osu já baixados do osu!: poucos KB cada. Só os ranked e loved, que não mudam mais.
CREATE TABLE beatmaps_do_osu (
    beatmap_id BIGINT PRIMARY KEY,
    beatmapset_id BIGINT,
    md5 TEXT NOT NULL,
    status TEXT NOT NULL,
    estrelas DOUBLE PRECISION NOT NULL,
    texto TEXT NOT NULL,
    baixado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Os pedidos feitos à API do osu! no último minuto, contados por todas as instâncias da API.
CREATE TABLE pedidos_ao_osu (
    feito_em TIMESTAMPTZ NOT NULL
);

CREATE INDEX pedidos_ao_osu_por_tempo ON pedidos_ao_osu (feito_em);
