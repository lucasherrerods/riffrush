-- Uma mensagem entre amigos pode sugerir uma música para tocar (JSON no formato da API).
-- Com a sugestão, o recado pode ir vazio.
ALTER TABLE mensagens_privadas ADD COLUMN sugestao TEXT CHECK (char_length(sugestao) <= 2000);
