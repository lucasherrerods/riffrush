# Pontos instáveis para verificar depois

Problemas encontrados de passagem, fora do escopo da mudança que estava sendo feita. Cada item diz onde apareceu, o que se viu e o que já se sabe. Quando um item for resolvido, apague-o daqui no mesmo PR da correção.

## Teste instável: `ranking_geral_da_a_posicao_certa_fora_do_top_e_no_empate`

- **Onde:** `backend/tests/postgres.rs`, job "Testes do backend" do CI.
- **O que se viu:** em 27/10/2026, no CI da `main` logo depois do merge do PR #125, o teste falhou num `assert_eq` (`left == right`). Rodando o job de novo, sem mudar nada, passou. O mesmo teste tinha passado no CI do próprio PR #125, que não mexe no ranking geral.
- **Suspeita:** o resultado depende do estado do banco ou da ordem/concorrência dos testes (por exemplo, outras contas e partidas criadas por testes que rodam ao mesmo tempo no mesmo Postgres, ou desempate por horário).
- **Próximo passo:** rodar `cargo test --test postgres ranking_geral` várias vezes seguidas com `DATABASE_URL` e ver se o teste isola os próprios dados.

## Migrações concorrentes nos testes do Mania

- **Onde:** `backend/tests/mania.rs` (função `banco()`), job "Testes do backend" do CI.
- **O que se viu:** em 30/10/2026, no CI do PR de amigos, três testes falharam em `as migrações falharam`: um com `duplicate key value violates unique constraint "_sqlx_migrations_pkey"` e os outros com `VersionMismatch`. É o primeiro arquivo de teste a usar o Postgres vazio. Na rodada anterior do mesmo PR, os mesmos testes passaram.
- **Suspeita:** os testes do arquivo rodam em paralelo, e cada um chama `sqlx::migrate!().run()` ao mesmo tempo num banco ainda sem as migrações, então dois tentam gravar a mesma versão.
- **Próximo passo:** aplicar as migrações uma vez antes dos testes (passo próprio no CI ou um `OnceCell` compartilhado em `banco()`) e conferir se `tests/postgres.rs` tem o mesmo risco.

## Teste instável: `carregarMusica (embutidas)`

- **Onde:** `frontend/src/modules/rock/songs/carregamento.test.ts`, na suíte inteira do frontend (`npm test`).
- **O que se viu:** em 29/10/2026, os testes "busca o áudio do arquivo do projeto e gera o chart automático" e "reaproveita o áudio ao trocar de dificuldade, sem buscar de novo" falharam na suíte inteira e passaram rodando o arquivo sozinho.
- **Suspeita:** dependem de tempo (timeout sob carga) ou de algum mock/cache de módulo que vaza de outro teste.
- **Próximo passo:** rodar a suíte inteira algumas vezes e ver a mensagem de erro; conferir se o cache de áudio é limpo no `beforeEach`.

## Aviso do clippy no lado nativo do app

- **Onde:** `frontend/src-tauri/src/lan/mod.rs:54`, ao rodar `cargo clippy -- -D warnings` em `frontend/src-tauri`.
- **O que se viu:** em 29/10/2026, na `main`, o clippy falha com `very complex type used` (`type_complexity`). O CI não roda o clippy nessa pasta, então passa.
- **Suspeita:** tipo aninhado (Arc/Mutex/Option…) escrito direto no campo, sem um `type` com nome.
- **Próximo passo:** extrair o tipo para um `type` com nome e, se fizer sentido, ligar o clippy do `src-tauri` no CI.


## Teste "as configurações ficam salvas" falhou uma vez na suíte inteira
- Onde: `frontend/src/app/App.test.tsx`, ao procurar a aba Gameplay.
- O que se viu: o `findByRole` estourou o tempo na suíte completa; rodando o arquivo sozinho, passou duas vezes.
- Suspeita: a tela de configurações é carregada sob demanda e demora mais que o limite padrão com a máquina sob carga.
- Próximo passo: repetir a suíte e, se voltar a falhar, aumentar o `timeout` desse `findByRole`.

## Teste "monta o jogo do modo ativo" falha às vezes na suíte inteira
- Onde: `frontend/src/app/App.modo.test.tsx`.
- O que se viu: em 05/11/2026 falhou na suíte completa (já tinha falhado uma vez antes, no PR do giro de modo); rodando o arquivo sozinho, passou três vezes seguidas.
- Suspeita: o modo é carregado sob demanda (`carregarTelaDoMania`) e demora mais que o limite padrão com a máquina sob carga, como o teste das configurações acima.
- Próximo passo: ver qual `findBy` estoura e dar a ele um `timeout` maior, ou pré-carregar o modo no teste.

## Testes do menu e da sala estouram o tempo na suíte inteira
- Onde: `frontend/src/modules/menu/MenuPrincipal.test.tsx` ("Tutoriais abre os tutoriais...") e `frontend/src/modules/multiplayer/sala.test.ts` ("criar a sala abre o servidor...").
- O que se viu: em 05/11/2026 falharam na suíte completa junto com os de carregamento e de modo; rodando os arquivos sozinhos, passaram.
- Suspeita: o mesmo limite de 5 s com a máquina sob carga (a suíte levou mais de 8 minutos).
- Próximo passo: ver se a suíte com `pool: 'vmThreads'` ou menos workers some com esses estouros antes de mexer em cada `timeout`.

## `frontend/src/app/App.modo.test.tsx` › "monta o jogo do modo ativo"
- Onde: `npm test` com a suíte inteira, na branch da seleção do Mania.
- O que se viu: falhou uma vez na suíte inteira; rodando o arquivo sozinho passa, com e sem a mudança.
- Suspeita: tempo de espera curto para montar o modo com a máquina carregada (carregamento preguiçoso do modo).
- Próximo passo: rodar a suíte algumas vezes e, se repetir, aumentar o tempo do `findBy` ou esperar o carregamento do modo.

## `App.modo.test.tsx` estoura o tempo com a suíte inteira rodando
- Onde: `frontend/src/app/App.modo.test.tsx`, "monta o jogo do modo ativo".
- O que se viu: falhou uma vez na suíte inteira (não achou o título "Riff Rush Mania" em 5 s) e passou sozinho logo depois. Os testes embutidos de `rock/songs/carregamento.test.ts` falharam na mesma rodada e também passaram sozinhos.
- Suspeita: o carregamento preguiçoso do modo demora mais que o `timeout` quando a máquina está carregada.
- Próximo passo: medir o tempo do import do Mania no teste e subir o limite ou carregar o módulo antes.
