-- Partidas antigas ficam sem a maior sequência: os apps só passaram a mandar agora.
ALTER TABLE partidas ADD COLUMN maior_sequencia INTEGER;
