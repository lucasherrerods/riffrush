-- Os pedidos feitos ao Encore nos últimos segundos. Todas as instâncias da API contam aqui,
-- para juntas não passarem do limite do Encore. Linhas antigas são apagadas a cada pedido.
CREATE TABLE pedidos_ao_encore (
    feito_em TIMESTAMPTZ NOT NULL
);

CREATE INDEX pedidos_ao_encore_por_tempo ON pedidos_ao_encore (feito_em);
