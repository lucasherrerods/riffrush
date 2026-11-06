-- A precisão volta a pesar cada acerto pelo julgamento. As partidas já julgadas guardam o valor dos acertos, então não precisam de rejulgamento.
UPDATE partidas
SET precisao = valor_dos_acertos::DOUBLE PRECISION / (total * 300)
WHERE regras = 2 AND precisao IS NOT NULL AND valor_dos_acertos IS NOT NULL AND total > 0;
