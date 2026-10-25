-- Nome, banda e capa de cada música que aparece nos rankings. O banco das partidas só tem o id;
-- estes dados vêm do Encore (ou do nome do arquivo) e ficam guardados para não consultar de novo.
-- Sem título: a música foi procurada e não foi achada.
CREATE TABLE musicas (
    musica_id TEXT PRIMARY KEY,
    titulo TEXT,
    artista TEXT,
    capa TEXT,
    buscada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
