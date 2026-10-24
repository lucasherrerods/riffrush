-- O e-mail do Google, para a pessoa ver com qual conta entrou.
ALTER TABLE contas ADD COLUMN email TEXT;

-- As contas que já existiam ainda não têm e-mail. Encerrar as sessões delas faz o app pedir
-- um novo login, que grava o e-mail na mesma conta (o google_sub é único, não duplica).
DELETE FROM sessoes WHERE conta_id IN (SELECT id FROM contas WHERE email IS NULL);
