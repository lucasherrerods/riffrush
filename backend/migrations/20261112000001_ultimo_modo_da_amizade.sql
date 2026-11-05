-- O modo de jogo (Rock ou Mania) aberto na última vez que a pessoa foi vista, para os amigos.
ALTER TABLE fichas_de_amizade ADD COLUMN ultimo_modo TEXT CHECK (ultimo_modo IN ('rock', 'mania'));
