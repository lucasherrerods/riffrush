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
