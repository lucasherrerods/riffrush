-- O código que a pessoa passa aos amigos e quando ela apareceu pela última vez.
CREATE TABLE fichas_de_amizade (
    conta_id UUID PRIMARY KEY REFERENCES contas (id) ON DELETE CASCADE,
    codigo TEXT NOT NULL UNIQUE,
    visto_em TIMESTAMPTZ
);

-- Pedido pendente ou amizade aceita. Um par só tem uma linha, venha de quem vier.
CREATE TABLE amizades (
    solicitante UUID NOT NULL REFERENCES contas (id) ON DELETE CASCADE,
    destinatario UUID NOT NULL REFERENCES contas (id) ON DELETE CASCADE,
    aceita BOOLEAN NOT NULL DEFAULT false,
    criada_em TIMESTAMPTZ NOT NULL,
    aceita_em TIMESTAMPTZ,
    PRIMARY KEY (solicitante, destinatario),
    CHECK (solicitante <> destinatario)
);

CREATE UNIQUE INDEX amizades_um_par ON amizades (LEAST(solicitante, destinatario), GREATEST(solicitante, destinatario));
CREATE INDEX amizades_por_destinatario ON amizades (destinatario);

CREATE TABLE bloqueios (
    quem UUID NOT NULL REFERENCES contas (id) ON DELETE CASCADE,
    bloqueado UUID NOT NULL REFERENCES contas (id) ON DELETE CASCADE,
    criado_em TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (quem, bloqueado),
    CHECK (quem <> bloqueado)
);

CREATE INDEX bloqueios_por_bloqueado ON bloqueios (bloqueado);
