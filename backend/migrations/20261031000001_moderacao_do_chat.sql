-- Quem é da equipe: apaga mensagens, bane e vê as denúncias do chat global.
-- Para pôr alguém: INSERT INTO equipe (conta_id) SELECT id FROM contas WHERE email = '...';
CREATE TABLE equipe (
    conta_id UUID PRIMARY KEY REFERENCES contas (id) ON DELETE CASCADE
);

-- Banido do chat global continua lendo, mas não escreve.
CREATE TABLE banimentos_do_chat (
    conta_id UUID PRIMARY KEY REFERENCES contas (id) ON DELETE CASCADE,
    banido_por UUID REFERENCES contas (id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A cópia da mensagem denunciada fica aqui, porque a mensagem some do chat em 24 horas.
-- Excluir a conta de quem escreveu ou de quem denunciou apaga a denúncia junto.
CREATE TABLE denuncias_do_chat (
    mensagem_n BIGINT NOT NULL,
    autor_id UUID NOT NULL REFERENCES contas (id) ON DELETE CASCADE,
    autor_nome TEXT NOT NULL,
    texto TEXT NOT NULL,
    mensagem_em TIMESTAMPTZ NOT NULL,
    denunciante_id UUID NOT NULL REFERENCES contas (id) ON DELETE CASCADE,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (mensagem_n, denunciante_id)
);

CREATE INDEX denuncias_por_data ON denuncias_do_chat (criada_em DESC);
