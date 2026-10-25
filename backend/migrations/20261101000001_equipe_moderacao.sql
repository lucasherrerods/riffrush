-- O nome deixa claro que é a equipe da moderação do chat, e não um papel da conta no jogo todo.
-- Para pôr alguém: INSERT INTO equipe_moderacao (conta_id) SELECT id FROM contas WHERE email = '...';
ALTER TABLE equipe RENAME TO equipe_moderacao;
