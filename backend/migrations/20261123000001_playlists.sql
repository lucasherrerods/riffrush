-- As playlists dos jogadores. O id vem do jogo, para a criada sem internet manter o mesmo quando subir.
CREATE TABLE playlists (
    id UUID PRIMARY KEY,
    conta_id UUID NOT NULL REFERENCES contas (id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    -- rock ou mania.
    modo TEXT NOT NULL,
    -- Aparece no perfil para os amigos.
    publica BOOLEAN NOT NULL,
    atualizada_em TIMESTAMPTZ NOT NULL
);

CREATE INDEX playlists_por_conta ON playlists (conta_id, atualizada_em DESC);

-- A versão é a dificuldade no Rock e o hash do beatmap no Mania.
CREATE TABLE faixas_da_playlist (
    playlist_id UUID NOT NULL REFERENCES playlists (id) ON DELETE CASCADE,
    posicao INTEGER NOT NULL,
    musica TEXT NOT NULL,
    versao TEXT NOT NULL,
    titulo TEXT NOT NULL,
    PRIMARY KEY (playlist_id, posicao)
);
