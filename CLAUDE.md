# Riff Rush

Jogo de ritmo estilo Guitar Hero / Clone Hero para desktop (Tauri), com multijogador em LAN e online de até 4 jogadores. Celulares jogam pelo navegador. Contas com login Google e nível de jogador ficam numa API própria.

## Repositório

```
frontend/   o jogo: React + Tauri (desktop) + versão web servida aos celulares
backend/    a API em Rust (contas, XP, partidas)
  relay/    Worker da Cloudflare do modo online, até ele virar parte da API
  motor/    regras da partida em Rust: a API rejulga replays com elas e o app roda as mesmas em WASM
  motor-mania/  as mesmas peças para o modo Mania (beatmaps do osu!mania), num crate à parte do Rock
landing/    site de divulgação do jogo (Vite + React), usa as cores e a identidade do frontend
.github/    CI (precisa ficar na raiz)
CLAUDE.md   este arquivo, único para o projeto inteiro
```

Cada lado tem as próprias dependências e comandos. Rode os comandos de dentro da pasta (`cd frontend`, `cd backend`).

## Regras gerais

Valem para o frontend e para o backend.

### TDD
- Escreva o teste antes da funcionalidade. O teste falha, o código o faz passar, depois refatore.
- Todo bug corrigido ganha um teste que reproduz o problema, para ele não voltar.
- Lógica (cálculos, parsers, regras do jogo, regras de XP) fica em funções puras testáveis, fora de componentes, rotas e acesso ao banco.
- Teste unitário fica junto do código: `arquivo.ts` → `arquivo.test.ts`; no Rust, `mod tests` no fim do próprio arquivo.
- Teste que cruza módulos fica em pasta própria: `backend/tests/` (API + banco) e `frontend/e2e/` (fluxos no app).

### Código
- Nunca duplique código ou componentes. Se algo se repete, extraia para o módulo dono ou para a pasta compartilhada.
- Pastas em inglês (`shared`, `modules`, `styles`).
- O resto em português: nomes de arquivos, funções, variáveis, tipos, componentes, rotas, textos da interface e testes. Termos de bibliotecas, do React e do Rust continuam como são.
- Cada módulo expõe uma API pública (`index.ts` no frontend, `mod.rs` no backend). Outros módulos importam só dela, nunca de arquivos internos.
- Comentários só quando explicam algo que o código não mostra, em frases simples.
- Segredos só por variável de ambiente. Toda variável nova entra no `.env.example` do lado dela.

### Economia de tokens
- Durante o trabalho, rode só o teste do arquivo alterado. A suíte inteira roda só no final.
- Use saídas curtas: `npm test -- --reporter=dot` e `cargo test -q`.
- Não rode builds a cada passo, só antes do PR.
- Leia `frontend/docs/design.md` só quando a mudança for de interface.
- Não leia nem busque em `node_modules`, `dist`, `coverage`, `target`, `.wrangler` e arquivos de áudio.

### Problemas encontrados de passagem
- Se aparecer algo instável ou suspeito que não tem a ver com a mudança em andamento (um teste que falha e depois passa, um aviso estranho, um bug de outra tela), não corrija nesse PR: anote em `pontos-instaveis-para-verificar-depois.md`, na raiz, com onde apareceu, o que se viu, a suspeita e o próximo passo.
- Se o problema tiver a ver com a mudança em andamento, ele é parte dela: corrija no mesmo PR e não anote.
- Quando um item de `pontos-instaveis-para-verificar-depois.md` for resolvido apague o item do arquivo na mesma correção do PR.

### Git
- Commits convencionais, curtos e em português: `feat: adiciona sustain nas notas`, `fix: corrige atraso do input`, `test: cobre parser de .chart`.
- Nunca adicione co-autor nos commits nem assinatura nas descrições de PR.
- Um PR por funcionalidade ou pedido, sem misturar contextos. Abra o PR ao terminar.
- A descrição do PR é escrita para quem vai revisar o código, não como resposta para quem pediu. Escreva como um engenheiro sênior explicando a mudança de forma simples: o problema, o que mudou e por quê, como foi testado e o que precisa no deploy. Nada de falar com o leitor ("você", "se você já rodou..."), recados da conversa ou instruções pessoais.
- Nada que comprometa a segurança entra em commit, mensagem de commit, título ou descrição de PR: segredos, tokens, chaves, senhas, valores de `.env`, fichas ou assinaturas reais, e-mails e ids de contas reais, endereços internos ou o passo a passo de uma falha ainda não corrigida. Em exemplos, use valores fictícios (`'...'`, `alguem@exemplo.com`). O repositório é público, e o que entra no histórico do git não sai mais.
- Cada PR parte da `main` atualizada.
- Todo PR aponta para a `main`, nunca para a branch de outro PR. Se depender de outro PR, espere ele entrar na `main` e atualize a sua branch; PR mesclado em outra branch não chega na `main` e o trabalho se perde.
- Mudança que precisa dos dois lados (API + tela) pode ir num PR só, desde que seja uma funcionalidade só.
- A Vercel só publica a branch `producao` (jogo e landing, pelo `vercel.json` de cada um). A `main` e os PRs não geram deploy. Para publicar, abra um PR da `main` para a `producao`.

## Frontend (`frontend/`)

### Stack
- Tauri 2 (Rust) + React 19 + TypeScript + Vite
- Tailwind CSS 4 + shadcn/ui + lucide-react + framer-motion
- Regras da partida: o crate `backend/motor`, compilado para WASM em `src/modules/rock/gameplay/wasm` (gerado por `npm run motor` e commitado, para o build web não precisar de Rust). Para gerar: `rustup target add wasm32-unknown-unknown` e `cargo install wasm-bindgen-cli --version 0.2.100`.
- Vitest + Testing Library

### Comandos

```bash
cd frontend
npm run tauri dev   # abre o app desktop
npm run dev         # só a versão web
npm test            # roda os testes uma vez
npm run test:watch  # testes em modo watch
npm run build       # typecheck + build web (também é a versão servida aos celulares)
npm run lancar -- 0.2.0   # sobe a versão e gera em release/ o instalador assinado e o latest.json do updater
npm run motor       # recompila os motores (backend/motor e backend/motor-mania) para WASM; `npm run motor -- mania` só um
cargo test --manifest-path src-tauri/Cargo.toml   # testes do lado Rust do app
```

### Estrutura

```
frontend/
  src/
    app/            composição das telas e navegação
    shared/         ui (shadcn), utilitários e estilos globais
    modules/<nome>/ uma pasta por funcionalidade
  src-tauri/        lado nativo do app (Rust): janela, servidor da LAN
  docs/design.md    regras visuais
```

### Design
- Toda mudança de interface segue `frontend/docs/design.md`.
- Use os tokens de cor e espaçamento definidos em `src/shared/styles`, nunca cores soltas.
- Exceção: o brilho neon é permitido apenas dentro do canvas da pista (notas, explosões, trilhos), por ser efeito de jogo. Menus, painéis e botões seguem a regra de não usar sombras no tema escuro.

### Falando com a API
- Toda chamada à API fica no `api.ts` do módulo dono, nunca dentro de componentes.
- O endereço vem de `VITE_URL_DA_API`.
- O frontend não calcula o que a API decide (XP, nível): ele mostra o que a API devolve.

## Backend (`backend/`)

### Stack
- Rust + axum + tokio + tower-http
- PostgreSQL + sqlx (migrações e consultas com `query_as`, cobertas pelos testes de integração)
- oauth2 + jsonwebtoken (login Google), thiserror, tracing, utoipa (OpenAPI)

### Comandos

```bash
cd backend
cargo run                      # sobe a API (lê o .env)
cargo test -q                  # testes unitários e de integração (os do Postgres só com DATABASE_URL)
cargo clippy -- -D warnings    # lint; o CI falha com qualquer aviso
cargo fmt                      # formatação
sqlx migrate add <nome>        # cria uma migração nova
sqlx migrate run               # aplica as migrações
```

### Arquitetura hexagonal

O backend segue a arquitetura hexagonal (portas e adaptadores), organizada por funcionalidade. O domínio fica no centro e não conhece HTTP nem banco. O mundo de fora fala com ele por portas (traits), e cada tecnologia é um adaptador que implementa ou chama essas portas.

```
backend/
  src/
    main.rs                 só monta tudo: config, pool do banco, adaptadores, rotas
    lib.rs                  expõe o app para os testes de integração
    shared/                 erro da API, config, estado do app
    modules/<nome>/
      mod.rs                API pública do módulo
      dominio.rs            entidades e regras puras
      portas.rs             traits que o domínio precisa (repositórios, provedores)
      casos_de_uso.rs       orquestra domínio + portas; uma função por ação
      http.rs               adaptador de entrada: rotas axum
      postgres.rs           adaptador de saída: implementa os repositórios com sqlx
      <servico>.rs          outros adaptadores de saída (ex.: google.rs)
  migrations/               migrações do sqlx
  tests/                    testes de integração (API + Postgres)
```

Regras:
- O sentido das dependências é sempre para dentro: `http.rs` e `postgres.rs` dependem do domínio, nunca o contrário.
- `dominio.rs` e `casos_de_uso.rs` não importam axum, sqlx, reqwest nem nada de infraestrutura.
- Toda dependência externa (banco, Google, relógio, gerador de ids) entra no caso de uso por uma porta, para os testes trocarem por um fake.
- Casos de uso são testados com fakes das portas, sem banco e sem rede.
- O adaptador HTTP só traduz: lê a requisição, chama o caso de uso, converte o resultado em resposta. Sem regra de negócio nas rotas.
- Tipos do banco e do JSON ficam nos adaptadores. O domínio usa os próprios tipos.
- Uma funcionalidade nova é um módulo novo em `modules/`, não uma camada global de controllers ou services.
- Um módulo usa outro só pela API pública do `mod.rs`.

### Regras do backend
- A API é a fonte da verdade: XP, nível e validações de partida são calculados no servidor, nunca confiados ao cliente.
- Erros do domínio usam `thiserror` e são convertidos em resposta HTTP num lugar só (`shared/erro.rs`).
- Nada de `unwrap`/`expect` fora de testes e do `main`.
- Toda mudança de banco é uma migração nova. Nunca edite uma migração que já foi para a `main`.
- Toda rota nova entra no OpenAPI (utoipa).
- Rotas que recebem dados do cliente validam limites (tamanho, faixa de valores, frequência).
- Logs com `tracing`, sem dados pessoais nem tokens.

## Landing (`landing/`)

Site de divulgação com uma demo jogável. Tem `package.json` próprio: `cd landing && npm run dev` (porta 1440), `npm test` e `npm run build`. Não copia nada do jogo: importa de `frontend/` pelo alias `@jogo` (tokens, `identidade.css`, ícones, logo e imagens). O que for compartilhado não pode depender de pacotes que só o frontend instala.

## Relay (`backend/relay/`)

Worker da Cloudflare que repassa as mensagens das salas online. Tem `package.json` próprio: `cd backend/relay && npm test`, e `npm run deploy` para publicar. Segue o mesmo contrato do servidor da LAN em `frontend/src-tauri/src/lan`.
