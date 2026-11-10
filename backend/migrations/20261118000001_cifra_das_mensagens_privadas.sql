-- O texto das mensagens passa a ser guardado cifrado pela API. A coluna antiga fica
-- só até a API cifrar as mensagens que já existiam, o que ela faz ao subir.
ALTER TABLE mensagens_privadas ADD COLUMN texto_cifrado BYTEA;
ALTER TABLE mensagens_privadas ALTER COLUMN texto DROP NOT NULL;
ALTER TABLE mensagens_privadas ADD CONSTRAINT mensagens_privadas_com_texto CHECK (texto IS NOT NULL OR texto_cifrado IS NOT NULL);
