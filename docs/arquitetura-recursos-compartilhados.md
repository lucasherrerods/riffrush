# Recursos globais compartilhados entre Rock e Mania

Este documento é o plano para levar ao Mania as funcionalidades globais do Rock: amigos, chat, rankings, seleção de música, leaderboards e perfil. Segue o padrão já usado no player de música: o código comum fica num módulo neutro, e cada modo entra só com os dados e o tema dele.

## Princípio: componentes burros + adaptadores por modo

```
modules/<recurso>/          neutro: componentes burros, tipos, regras puras, api.ts
modules/rock/<recurso>/     adaptador do Rock: busca os dados do Rock e monta o componente
modules/mania/<recurso>/    adaptador do Mania: o mesmo, com os dados do Mania
```

- **O componente burro** recebe tudo por props: os dados, os rótulos e os callbacks. Ele não importa `rock/` nem `mania/`, não chama API e não sabe em que modo está.
- **A cor vem só dos tokens** (`bg-fundo`, `text-primaria`…). O tema de cada modo já é aplicado no `<main>` do modo, por `aplicarTokens`. Assim o mesmo painel sai preto no Rock e uva com rosa no Mania sem nenhum `if (modo)`.
- **O tipo `Modo`** (`"rock" | "mania"`) e o modo aberto vivem em `shared/modo.ts`. O modo é usado só como dado: a etiqueta no chat, o status do amigo. Ele nunca escolhe estilo, porque estilo vem do tema.
- **O teste `fronteiras`** passa a cobrir também `modules/selecao`, `modules/player` e `shared`: nenhum deles pode importar de `modules/rock` nem de `modules/mania`. `amigos`, `ranking` e `conta` ainda usam tipos de `rock/songs` e ficam de fora até esses tipos saírem de lá.

## 1. Amigos: em que modo a pessoa está

- **Relay/presença:** o estado online ganha o campo `modo`. O app manda o modo ao conectar e de novo a cada troca de modo (o `App` chama `presenca.definirModo`).
- **Backend:** a migração põe `ultimo_modo` em `fichas_de_amizade`. O app abre a lista com `GET /amigos?modo=...`, e a API grava o modo junto com o `visto_em` que já existe e devolve `ultimo_modo` de cada amigo.
- **Frontend:** `PainelDeAmigos` já fica em `modules/amigos` (neutro). Ele passa a mostrar um `EtiquetaDeModo` com o texto "Jogando Mania" para quem está online, ou "Visto no Rock há 2h" para quem está offline. O painel é montado pelos dois modos, com o tema de cada um.

## 2. Chat global com a etiqueta do modo

- **Um canal só:** o histórico continua único e só ganha a etiqueta. Cada mensagem leva o modo de quem a enviou, no momento do envio: o protocolo do relay ganha `modo` na mensagem. O relay só aceita `rock` ou `mania` e descarta o resto; como o campo vira apenas uma etiqueta, não há o que proteger além do formato.
- **Mensagens antigas** chegam sem o campo e aparecem sem etiqueta.
- **`ChatGlobal`/`PainelDeChat`** vão para um uso neutro: ganham `<EtiquetaDeModo modo={m.modo} />` ao lado do nome. O mesmo componente monta nos dois modos.
- **Peça compartilhada:** `EtiquetaDeModo` fica em `shared/ui` e é usada pelos amigos e pelo chat. Ela aplica no próprio elemento o tema do modo que mostra (`estiloDoTema`), então a etiqueta "Rock" sai vermelha dentro do Mania e a "Mania" sai rosa dentro do Rock, sem tokens novos.

## 3. Ranking do Mania com replay só do top 10

**O que já existe:** as tabelas próprias `partidas_do_mania` e `partidas_do_mania_pendentes`, separadas do Rock. **O problema:** a coluna `replay` é gravada em toda partida com `vale_ranking`, então ela cresce sem limite.

- **Nova migração:**
  - Criar a tabela `replays_do_mania (partida_id UUID PK REFERENCES partidas_do_mania ON DELETE CASCADE, replay BYTEA NOT NULL)`. Com isso o BYTEA sai da tabela quente e as consultas de ranking não carregam TOAST.
  - Mover os replays do top 10 atual para a tabela nova.
  - Derrubar a coluna `partidas_do_mania.replay`.
- **Caso de uso `registrar_partida_do_mania`:** roda numa transação só.
  1. Insere a partida.
  2. Calcula o top 10 do `beatmap_id`, contando o melhor recorde de cada conta, sobre o índice `partidas_do_mania_do_ranking` que já existe.
  3. Se a partida nova ficou no top 10, grava o replay.
  4. Apaga de `replays_do_mania` o replay de quem saiu do top 10.
- **Limite do banco:** no máximo 10 replays por mapa. Um replay de mania tem poucos KB, então mesmo 10 mil mapas ficam na casa de centenas de MB, no pior caso.
- **Porta `RepositorioDoMania`:** ganha `top_do_mapa`, `guardar_replay` e `descartar_replays_fora_do_top`. Os testes do caso de uso usam um fake com 11 jogadores e conferem que sobram 10 replays.
- **Rota de replay:** passa a ler de `replays_do_mania`. Ela responde 404 quando a partida saiu do top, e a interface esconde o botão "assistir" com o `tem_replay` que a consulta devolve.

## 4. Vida (pesquisa no osu!)

Hoje o motor tira `-0.04 × (1 + HP/10)` por Miss e dá no máximo `+0.01` por acerto. Pior ainda, aplica o Miss cheio duas vezes em cada nota longa perdida, uma na cabeça e outra na cauda.

O osu! (lazer, `ManiaHealthProcessor`, que replica o stable) faz assim, com D = HP do mapa:

| Julgamento | Vida |
|---|---|
| MAX | `+(0.0055 − 0.0005·D) × mult` |
| 300 | `+(0.005 − 0.0005·D) × mult` |
| 200 | `+(0.004 − 0.0004·D) × mult` |
| 100 | `0` |
| 50 | `−(D + 1) × 0.0016` |
| Miss, nota comum | `−(D + 1) × 0.0075` |
| Miss, cabeça ou cauda de nota longa | `−(D + 1) × 0.00375` (metade) |

- **Sem dreno passivo no mania:** o comentário do lazer diz que isso espelha o comportamento do stable.
- **O `mult` (`HpMultiplierNormal`)** é calculado uma vez por mapa, como no `LegacyDrainingHealthProcessor`: o motor simula uma partida perfeita com um dreno de teste e aumenta a recuperação em 1% até o mapa terminar com vida sobrando (`recuperacao_do_mapa`).
- **Plano:**
  1. Trocar `variacao_da_vida` em `backend/motor-mania/src/partida.rs` pela tabela acima e passar `ponta` para dividir o Miss das notas longas.
  2. Fazer o EZ continuar pela metade.
  3. Escrever primeiro os testes: o Miss da nota longa custa metade, o HP 0 quase não drena, e um mapa de HP 8 com 10% de Miss espalhados não mata.
  4. Rodar `npm run motor -- mania`.
- **Rejulgamento:** isso muda o resultado dos replays rejulgados (a derrota pode mudar). Como o motor é o mesmo no app e na API, os dois lados mudam juntos. Partidas antigas não são reprocessadas.

## 5. Seleção de música do Mania igual à do Rock

- **Mudança na interface:** a tela de biblioteca do Mania deixa de existir, e `TelaDeSelecaoMania` passa a usar o carrossel do Rock.
- **Extração:** o `Carrossel` e a geometria dele (`geometriaDoCarrossel.ts`) saíram de `rock/library` para o módulo neutro `modules/selecao`. O carrossel recebe itens já descritos (`ItemDoCarrossel`: título, artista, capa montada, estrelas) e dificuldades com a cor da faixa e a melhor partida (`DificuldadeDoCarrossel`).
- **Adaptadores:**
  - O Rock monta a tela a partir de `Musica`.
  - O Mania monta a partir de `ConjuntoSalvo`, com as dificuldades do conjunto no lugar dos níveis e a cor pela faixa de estrelas do osu!. O painel ao lado tem os mods, o importar `.osz`, o ranking da dificuldade e os botões de jogar e treinar.

## 6. Leaderboards: XP compartilhado e mapas mais jogados

- **XP:** o XP é um só por conta (`progresso`), então a aba de XP usa a mesma rota e as mesmas pessoas nos dois modos. Nada muda no backend.
- **`TelaDeLeaderboard`:** a aba de XP é a mesma. A segunda aba aceita `rotuloDasMusicas` e `abaDasMusicas`: o Rock continua com as músicas, e o Mania passa "Mapas" com `AbaDosMapasMaisJogados`, que usa a mesma `LinhaComPosicao` e abre o ranking da dificuldade.
- **Backend:** criar a rota nova `GET /mania/mapas-mais-jogados`.
  - Consulta: `COUNT` por `beatmap_id` (dificuldade) em `partidas_do_mania`, com o primeiro lugar de cada uma. Título, artista e dificuldade saem do `.osu` guardado em `beatmaps_do_osu`, lido pelo motor; sem ele, o app usa o nome da biblioteca.
  - Índice parcial novo: `(beatmap_id) WHERE vale_ranking`.
  - Entra no OpenAPI, com limite de 50 resultados.

## 7. Perfil e estatísticas do Mania

- **`TelaDePerfil`:** a parte de cima, com foto, nível e XP, continua igual. A prop `estatisticas` troca a parte de baixo pelos números do modo, desenhados com o mesmo cartão (`shared/ui/NumeroDestacado`).
- **Estatísticas do Rock:** continuam as de hoje.
- **Estatísticas do Mania:** partidas, precisão média, maior combo, contagem de SS/S, top 10 em mapas, contagem de MAX/300 e mapas favoritos.
  - Saem de uma rota nova, `GET /eu/mania/estatisticas`, no módulo `mania` do backend.
  - A consulta é agregada em `partidas_do_mania`, sobre o índice `por_conta` que já existe.
- **Abertura:** o perfil mostra as estatísticas do modo em que a pessoa está.

## Entrega

Tudo foi num PR só, a pedido. A ordem de dependência continua valendo para revisar: base (`shared/modo`, etiqueta, fronteiras) → vida → replays → presença e amigos → chat → seleção → leaderboard e perfil.
