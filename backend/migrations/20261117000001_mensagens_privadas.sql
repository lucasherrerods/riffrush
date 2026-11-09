-- Mensagens entre amigos. Somem junto com a conta de quem mandou ou de quem recebeu.
CREATE TABLE mensagens_privadas (
    id BIGSERIAL PRIMARY KEY,
    de UUID NOT NULL REFERENCES contas (id) ON DELETE CASCADE,
    para UUID NOT NULL REFERENCES contas (id) ON DELETE CASCADE,
    texto TEXT NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 200),
    enviada_em TIMESTAMPTZ NOT NULL,
    lida_em TIMESTAMPTZ,
    CHECK (de <> para)
);

-- O histórico de um par, venha de quem vier, do mais novo para o mais velho.
CREATE INDEX mensagens_privadas_por_par ON mensagens_privadas (LEAST(de, para), GREATEST(de, para), id DESC);
-- As não lidas de quem recebe.
CREATE INDEX mensagens_privadas_nao_lidas ON mensagens_privadas (para, de) WHERE lida_em IS NULL;
