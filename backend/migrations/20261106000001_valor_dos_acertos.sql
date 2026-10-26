-- Soma do valor de cada acerto pelo julgamento (PERFEITO 300, ÓTIMO 100, BOM 50), para o perfil mostrar a
-- mesma precisão do jogo. Partidas antigas ficam sem o valor e contam cada acerto como perfeito.
ALTER TABLE partidas ADD COLUMN valor_dos_acertos INTEGER;
