# Mecânicas de jogo

Decisões sobre como o jogo funciona, para consulta dos devs. Não é lido pelo Claude a cada tarefa.

## Entrada das notas

Cada aperto de tecla (ou botão do controle) toca uma nota. Não existe palheta (strum) nem nota aberta. É como o gamepad mode do Clone Hero.

### Acerto ao soltar

Inspirado no gamepad mode da V1.1 do Clone Hero, que acerta notas tanto ao apertar quanto ao soltar. Isso facilita trechos de spam de notas, porque um aperto e uma soltura viram duas notas, como palhetar para cima e para baixo.

Regras (`soltar` em `src/modules/gameplay/partida.ts`):

- Soltar só acerta se o aperto daquela tecla acertou uma nota.
- A nota acertada é a mais próxima da mesma pista, dentro da janela de acerto.
- Uma soltura por aperto: para acertar de novo é preciso apertar de novo.
- Soltar sem nota por perto não tem castigo (não quebra a sequência).
- Largar um sustain antes do fim não acerta nota.

Vale para todos os modos, inclusive o multijogador, então ninguém tem vantagem.

## Pontuação igual em qualquer taxa de frames

Todo tempo que entra na partida é arredondado para uma grade de 1 ms (`quantizar` em `partida.ts`). Sustain e star power são contados em ticks inteiros, e o `avancar` aplica cada acontecimento no próprio tempo: nota perdida, fim do star power. Assim, a mesma partida dá exatamente a mesma pontuação a 60 fps, a 144 fps ou sem frames no meio. Um teste em `partida.test.ts` garante isso.

## Replay

Como o `.osr` do osu!, o replay guarda só as entradas do jogador, não vídeo (`src/modules/gameplay/replay.ts`):

- Cada entrada é apertar ou soltar uma pista, ou ativar o star power, com o tempo que a partida de fato usou.
- O formato é 1 byte de versão, fora da compressão, mais o deflate de: opções (sem falha, fantasma), hash do chart com 16 bytes de SHA-256, o primeiro tempo e um varint por entrada com o intervalo e o código da tecla.
- Uma música inteira fica com menos de 10 KB.
- Só a partida que vale para o ranking gera replay: sem bot, sem derrota e sem fantasma.
- A API guarda o replay só no recorde de cada jogador em cada música, dificuldade e instrumento. As outras partidas perdem o delas. O limite é de 64 KB.
- O replay só toca no mesmo chart. Se o hash não bater, a tela avisa que é de outra versão do chart.
