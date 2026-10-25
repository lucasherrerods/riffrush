# Relay do modo online

Servidor que repassa as mensagens das salas online. Ele não decide nada: quem manda na sala é o app do host, como na LAN. Roda no Cloudflare Workers com Durable Objects, que tem plano gratuito.

## Rodar local

```bash
cd relay
npm install
npm run dev        # sobe em ws://127.0.0.1:8787
```

No app, crie um `.env.local` na raiz com `VITE_URL_DO_RELAY=ws://127.0.0.1:8787`.

## Publicar

```bash
cd relay
npx wrangler login
npm run deploy     # mostra o endereço, ex.: https://riffrush-relay.<conta>.workers.dev
```

Use o endereço com `wss://` em `VITE_URL_DO_RELAY` na hora do build do app. Sem essa variável, o modo online fica escondido.

## Quem está online e partidas ao vivo

A lista de quem está online (`/presenca`) e a transmissão das partidas (`/transmissao/{id}`) só aceitam quem traz uma ficha assinada pela API. Configure o mesmo segredo nos dois lados:

```bash
npx wrangler secret put SEGREDO_DA_PRESENCA   # no relay
```

Na API, o mesmo valor vai em `SEGREDO_DO_RELAY`. Sem o segredo, essas duas partes ficam desligadas e as salas continuam funcionando.

A ficha vai como subprotocolo do WebSocket (`riffrush, <ficha>`), para não aparecer em logs de URL. Ainda se aceita `?ficha=` das versões antigas do app.

## Chat global

O chat global (`/chat`) usa a mesma ficha. Escrever pede nível 2, que vem assinado na ficha. As últimas 50 mensagens das últimas 24 horas ficam guardadas.

A equipe, que vê as denúncias, apaga mensagens e bane, são as contas listadas em `ADMINS_DO_CHAT`. Os ids das contas ficam separados por vírgula e estão na tabela `contas` da API:

```bash
npx wrangler secret put ADMINS_DO_CHAT   # ex.: 7f1c...-...,a2b4...-...
```

## Limites contra abuso

- Cada IP pode fazer 120 pedidos por minuto (`[[ratelimits]]` no `wrangler.toml`). Acima disso, o Worker responde 429 antes de acordar os Durable Objects.
- Os pedidos barrados ainda contam na cota grátis de 100 mil por dia. Para proteger a cota, crie também uma regra de rate limiting no painel da Cloudflare: Security > WAF > Rate limiting rules, por exemplo 300 pedidos a cada 10 s por IP, bloqueando por 1 minuto. Essa regra exige o relay num domínio próprio, porque não vale no `workers.dev`.

## Testes

```bash
npm test
npm run typecheck
```

## Limites do plano gratuito

100 mil requisições por dia, e cada mensagem WebSocket conta. O jogo manda o placar uma vez por segundo no online, o que dá umas 140 partidas de 4 jogadores por dia. Passou do limite, as conexões falham até a meia-noite UTC, sem cobrança.
