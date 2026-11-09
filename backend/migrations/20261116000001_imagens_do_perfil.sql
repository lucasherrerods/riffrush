-- Foto e capa escolhidas pela pessoa. A foto do Google fica guardada à parte para voltar quando ela remover a dela.
ALTER TABLE contas ADD COLUMN avatar_do_google TEXT, ADD COLUMN capa TEXT;
UPDATE contas SET avatar_do_google = avatar;

CREATE TABLE imagens_das_contas (
    conta_id UUID NOT NULL REFERENCES contas (id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('foto', 'capa')),
    formato TEXT NOT NULL,
    conteudo BYTEA NOT NULL,
    atualizada_em TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (conta_id, tipo)
);
