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

## Quem está online e partidas ao vivo

- **Presença:** o app só entra na lista depois que a pessoa aceita (`mostrarOnline`), e dá para desligar na tela Online. A API assina uma ficha de 5 minutos (HMAC, `POST /presenca/ficha`), e o relay confere a ficha com o mesmo segredo. Assim ninguém aparece com o nome de outra pessoa, e o relay não precisa conhecer as sessões.
- **Transmissão:** vai ao ar só a partida solo de quem deixa (`permitirEspectadores`), sem bot, com música do jogo ou do Encore. A `TelaDeJogo` manda as entradas do replay em lotes de 1 s, e o relay guarda tudo desde o início, para quem chega no meio alcançar a partida.
- **Quem assiste:** fica 2 s atrás de quem joga e monta a mesma partida com o modo replay. A partida não passa do último lote que chegou (`ateAgora`). Se sair mais de 1,5 s do ponto certo, como numa pausa ou num travamento da rede, a partida recomeça no lugar certo.
- **Música diferente:** sem a mesma música, ou com outro chart (hash diferente), a tela avisa em vez de tocar.
- **Baixar para assistir:** se a música for do Encore, o início da transmissão leva o link do chart. O relay e o app só aceitam o caminho exato de um `.sng` em `https://files.enchor.us` com o md5 da própria música (`linkDoChartConfere`). O download confere a assinatura do `.sng`, recusa arquivos acima do limite (esses ficam para a busca) e, antes de tocar, o hash das notas ainda tem que bater.

## Notas abertas, HOPO e tap

- **Nota aberta** (`N 7` no .chart; no .mid, a nota abaixo do verde com `ENHANCED_OPENS` ou o verde dentro do sysex do Phase Shift): vira a pista 5, desenhada como barra roxa atravessando o braço. Sai com uma tecla própria (padrão `D`, botão X no controle; configurável). Aberta junto com traste no mesmo tick é descartada, fica o traste, como no Clone Hero.
- **HOPO e tap** são lidos como no Clone Hero (HOPO natural até 65/192 de semínima no .chart e 170/480 no .mid; `N 5` inverte, notas 101/102 forçam, `N 6`/nota 104/sysex marcam tap), mas mudam só o visual: o Riff Rush não tem palhetada, então toda nota continua saindo só com o traste. O `hopo_frequency` do song.ini ainda não é lido.
- **Desligar a nota aberta** (`notaAberta` nas configurações, aba Gameplay): a aberta vira verde e sai com a tecla do verde. A troca acontece no motor (`OpcoesDaPartida.sem_aberta`), então o app e o rejulgamento da API dão o mesmo resultado. O número de notas não muda, por isso a partida continua valendo para o ranking, o replay e o ao vivo. O hash do chart é sempre o do chart original, e o replay guarda a opção no bit 4 do byte de opções (`semAberta`), sem mudar de versão: replays antigos não têm o bit e tocam com a aberta. A transmissão leva `semAberta` no início, e quem assiste monta a partida igual. No multijogador cada um usa a própria configuração, como as teclas.
- **Replay v2**: o intervalo vai vezes 13. Códigos 0 a 10 não mudaram (transmissão ao vivo compatível); 11 aperta e 12 solta a aberta. Replays v1 continuam sendo lidos.
