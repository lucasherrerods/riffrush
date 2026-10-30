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

