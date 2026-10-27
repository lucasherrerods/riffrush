# Desenvolvimento do modo Mania

Plano para acrescentar ao Riff Rush um segundo jogo, o **Riff Rush Mania**: um jogo de ritmo de teclas verticais compatível com os beatmaps do modo mania do osu!, ao lado do jogo atual, que passa a se chamar **Riff Rush Rock**.

Os dois modos vivem no mesmo app, mas funcionam como jogos independentes: regras, biblioteca, ranking, XP e visual próprios. A troca é feita por uma alavanca na tela inicial.

---

## 1. Objetivos

1. **Compatibilidade total com o osu!mania:** todos os números de teclas (1K a 10K, mais os mapas de dupla com até 18K), notas simples e longas, mudanças de velocidade (SV) e os mods de gameplay.
2. **Gameplay igual à do mania:** tocar a coluna na hora certa, sem palheta. Janelas de julgamento pelo OD do mapa, julgamentos MAX/300/200/100/50/Miss, precisão, notas (SS a D) e pontuação até 1.000.000.
3. **Dificuldades com a nomenclatura do osu!:** o nome que o mapper deu à dificuldade e as estrelas, com a faixa oficial (Easy, Normal, Hard, Insane, Expert, Expert+).
4. **Busca e download dentro do app**, direto do jogador para espelhos públicos, sem passar pelo nosso servidor.
5. **Partidas conferidas pelo servidor:** a API rejulga o replay com o mesmo motor, como já faz no modo Rock.
6. **Dois jogos independentes:** quebrar o Mania não pode afetar o Rock, nem o contrário. Cada um tem os próprios módulos, testes e ranking.
7. **Temas centralizados:** todas as cores num único lugar, e a troca de tema em tempo de execução. O Rock fica com o tema atual, o Mania usa rosa e branco.

## 2. Fora do escopo (por enquanto)

- Os outros modos do osu! (standard, taiko, catch) e a conversão automática deles para mania.
- O editor de mapas.
- Multijogador no Mania: entra numa fase posterior, depois que o modo solo estiver estável (ver seção 13).
- O login com a conta do osu! e o envio de pontuações para o osu!. O ranking é só o nosso.
- Skins do osu! (`skin.ini`). O Mania tem uma skin própria, configurável pelo tema.

---

## 3. Visão geral da arquitetura

```
┌──────────────────────────────── App (Tauri / web) ─────────────────────────────────┐
│                                                                                     │
│  app/  ── modo ativo: "rock" | "mania" ──► escolhe tema, logo, nome e telas         │
│                                                                                     │
│  shared/        tema em tempo de execução, componentes de UI, utilitários           │
│  modules/       compartilhados pelos dois modos: conta, audio, settings, menu,      │
│                 platform, presenca, gamepad, legal, ranking (só a tela)              │
│                                                                                     │
│  modules/rock/      (o jogo atual, sem mudanças de regra)                           │
│  modules/mania/     o jogo novo                                                     │
│     ├─ gameplay     pista vertical, entrada por teclas, HUD, resultado              │
│     ├─ beatmaps     parser .osu, importação .osz, biblioteca do Mania               │
│     ├─ busca        espelhos (catboy / nerinyan / osu.direct), download             │
│     └─ selecao      escolha de mapa, dificuldade, mods                              │
│                                                                                     │
│  motor WASM:  riffrush-motor (Rock)    riffrush-motor-mania (Mania)                 │
└──────────────────────────────────────┬──────────────────────────────────────────────┘
                                       │ replay (poucos KB)
┌──────────────────────────────────────▼────────────────── API (Rust) ────────────────┐
│  conta, progresso, presenca, moderacao        compartilhados                        │
│  rejulgamento    fila única, despacha pelo modo do replay                           │
│  catalogo/encore.rs   charts do Rock                                                │
│  catalogo/osu.rs      .osu do Mania (site oficial + cache + limitador)              │
│  ranking         tabelas e views separadas por modo                                 │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Princípios:**

- **O modo é um dado, não uma condição espalhada.** Um único lugar (`app/`) sabe qual modo está ativo e monta as telas certas. Os módulos de cada jogo não sabem que o outro existe.
- **Compartilha-se o que é infraestrutura** (conta, áudio, configurações gerais, UI, rede, fila de rejulgamento). **Não se compartilham regras de jogo.** O Rock e o Mania têm motores, julgamentos e pontuações diferentes, e misturar os dois criaria o acoplamento que queremos evitar.
- **Os dois modos seguem o mesmo contrato:** cada um expõe um `index.ts` com as telas (seleção, jogo, resultado, busca) e a sua identidade (tema, logo, nome). O `app/` só usa esse contrato.

---

## 4. Estrutura de pastas

### 4.1 Frontend

```
frontend/src/
  app/
    modo.ts                 tipo Modo, modo ativo, troca e persistência
    App.tsx                 monta as telas do modo ativo
  shared/
    styles/
      temas.ts              catálogo de temas (Rock, Mania e os outros)
      tema.tsx              ProvedorDeTema + useTema(): o tema ativo em tempo de execução
      tokens.ts             helpers de cor (brilho, croma, comAlfa) e aplicarTokens
  modules/
    rock/                   o que hoje está em gameplay, songs, library, search, stage, character
      index.ts              contrato do modo: telas + identidade
    mania/
      index.ts              contrato do modo: telas + identidade
      identidade.ts         nome, logo, tema padrão
      gameplay/
        TelaDeJogoMania.tsx
        partida.ts          adaptador do motor WASM do Mania
        entrada.ts          teclas por número de colunas (4K, 7K…)
        pista/              desenho da pista vertical (canvas)
        hud/                combo, precisão, julgamento, barra de vida
        resultado.ts        tela de resultado (nota, contagem de julgamentos)
        replay.ts           empacota o replay do Mania
        wasm/               saída do npm run motor:mania (commitado)
      beatmaps/
        osz.ts              descompacta o .osz
        biblioteca.ts       mapas do Mania salvos no aparelho
        dificuldades.ts     estrelas → Easy … Expert+
      busca/
        espelhos.ts         lista de espelhos, troca automática, tradutores
        api.ts              todas as chamadas externas do modo
        TelaDeBuscaMania.tsx
      selecao/
        TelaDeSelecaoMania.tsx
        mods.ts             mods disponíveis e o multiplicador de pontuação
      settings/
        configuracoesMania.ts  velocidade de rolagem, teclas por K, offset do Mania
```

A pasta `modules/rock/` é uma **reorganização**, sem mudança de comportamento: os módulos atuais (`gameplay`, `songs`, `library`, `search`, `stage`, `character`, `results`, `player`) passam a ficar dentro dela, e os testes atuais provam que nada mudou. Por ser grande, ela é feita num PR próprio, só de mudança de pastas (fase 1).

### 4.2 Motor

```
backend/motor/                riffrush-motor       (Rock, como hoje)
backend/motor-mania/          riffrush-motor-mania (novo)
  src/
    lib.rs
    beatmap.rs                parser .osu (seções General, Difficulty, TimingPoints, HitObjects)
    partida.rs                julgamento, pontuação, precisão, vida
    mods.rs                   efeito de cada mod nas regras
    replay.rs                 formato do replay do Mania
  wasm/                       bindings wasm-bindgen
  tests/paridade.json         casos que o TS e o Rust conferem iguais
backend/motor-comum/          (opcional) só o que é idêntico nos dois: quantização do tempo, compressão do replay
```

São crates separados para que uma mudança no Mania não recompile nem arrisque o Rock. Só vão para o `motor-comum` peças que já são iguais, nunca regra de jogo.

### 4.3 API

```
backend/src/modules/
  catalogo/osu.rs             adaptador: baixa o .osu do site oficial e confere o status
  rejulgamento/               ganha o despacho por modo (Rock → motor, Mania → motor-mania)
  ranking/                    separado por modo
  progresso/dominio.rs        XP por modo
```

---

## 5. Temas e customização

### 5.1 Situação atual

- As cores já estão concentradas em `shared/styles/temas.ts`, e o `aplicarTokens` as escreve em variáveis CSS ligadas ao Tailwind.
- **Mas o tema é fixo:** `temaAtivo` é uma constante e `cores` é lida uma vez quando o arquivo carrega. Trocar o tema hoje exige recarregar o app.
- Há cores soltas fora do tema em `character/`, `stage/cena.ts`, `songs/` e no canvas da pista.

### 5.2 O que muda

1. **Tema em tempo de execução:**
   - Um `ProvedorDeTema` guarda o tema ativo, chama `aplicarTokens` a cada troca e expõe `useTema()`.
   - Os componentes React já usam as variáveis CSS, então trocam sozinhos.
   - Os canvas (pista, palco, personagem) leem o tema por `useTema()` ou recebem o tema como parâmetro, e redesenham quando ele muda.
2. **Nenhuma cor fora do tema:**
   - Todas as cores soltas do app vão para o tema.
   - Um teste varre `src/` e falha se encontrar uma cor hexadecimal ou `rgb()` fora de `shared/styles/`. Logos de terceiros, como a do Google, ficam numa lista de exceções.
3. **O tema ganha os campos do Mania:**
   - `pistaMania`: cor de cada coluna por número de teclas, nota longa, linha de julgamento, cores de cada julgamento e fundo da pista.
   - `identidade`: nome do jogo e logo, para o app trocar o nome junto com as cores.
4. **Dois temas novos de primeira classe:**
   - **Riff Rush Rock:** o tema atual (`riffRush`), sem mudanças.
   - **Riff Rush Mania:** rosa e branco, com fundo claro, superfícies brancas, primária rosa, texto escuro e acentos em rosa mais escuro para contraste. Como é o primeiro tema claro, o `tokens.test.ts` passa a conferir o contraste mínimo (WCAG AA) também no claro.
5. **Os temas extras atuais** (Crimson Noir, Synthwave…) continuam como opção nas configurações, mas são do modo Rock. O Mania pode ganhar variações próprias no futuro.
6. **O `design.md` ganha uma seção do tema claro:** no claro, as sombras suaves são permitidas, e o brilho neon continua só na pista.

### 5.3 Contrato do tema

```ts
interface Tema {
  nome: string;
  esquema: "escuro" | "claro";
  identidade: { nomeDoJogo: string; logo: string };
  cores: { /* as de hoje */ };
  pista: { /* Rock, as de hoje */ };
  pistaMania: {
    colunas: Record<number, string[]>; // 1K…10K; 18K reaproveita o padrão de 9K
    notaLonga: string;
    linhaDeJulgamento: string;
    julgamentos: { max: string; 300: string; 200: string; 100: string; 50: string; miss: string };
  };
}
```

---

## 6. Alavanca de modo na tela inicial

### 6.1 Comportamento

- A tela inicial mostra uma alavanca, que começa sempre em **Rock** na primeira abertura.
- **Ao girar a alavanca:**
  - o app troca de modo e o modo novo fica salvo para a próxima abertura;
  - o tema troca, com uma transição curta (cerca de 400 ms) feita com framer-motion;
  - a logo e o nome trocam entre **Riff Rush Rock** e **Riff Rush Mania**;
  - os itens do menu (Jogar, Buscar músicas, Ranking) passam a abrir as telas do modo ativo.
- **Mantém-se entre os modos:** conta, nível de jogador, configurações de áudio e vídeo.
- **Cada modo tem a sua parte:** biblioteca, ranking, XP por modo e configurações de gameplay.

### 6.2 Acessibilidade e entrada

- **Teclado:** setas ou Enter giram a alavanca.
- **Controle:** o botão de troca do gamepad gira a alavanca.
- **Toque:** arrastar ou tocar gira a alavanca.
- **Leitor de tela:** a alavanca é um `role="switch"` com o rótulo "Modo de jogo: Rock".
- **Movimento reduzido:** com `prefers-reduced-motion`, a troca é imediata.

### 6.3 Onde fica

- **Componente:** `modules/menu/AlavancaDeModo.tsx`, que só chama `trocarModo()` de `app/modo.ts`.
- **Lógica:** a troca e a persistência ficam em `modo.ts`, com teste próprio.
- **Ativação:** a alavanca só aparece quando a fase 7 for concluída. Até lá, o Mania fica atrás de uma flag de desenvolvimento.

---

## 7. Formato .osu e compatibilidade

### 7.1 O que o parser lê

| Seção | Campos usados |
|---|---|
| `[General]` | `AudioFilename`, `AudioLeadIn`, `PreviewTime`, `Mode` (só aceita 3 = mania) |
| `[Metadata]` | título, artista (com as versões Unicode), mapper, `Version` (nome da dificuldade), `BeatmapID`, `BeatmapSetID` |
| `[Difficulty]` | `CircleSize` = número de teclas, `OverallDifficulty` = janelas, `HPDrainRate` = vida |
| `[Events]` | imagem e vídeo de fundo |
| `[TimingPoints]` | BPM (para as linhas de compasso) e SV (velocidade de rolagem) |
| `[HitObjects]` | coluna = `floor(x × teclas / 512)`, tempo, tipo (nota ou nota longa com `endTime`) |

Arquivos com versões de formato antigas (v5 a v14) precisam ser lidos. Os testes cobrem um mapa de cada faixa de versão.

### 7.2 Números de teclas

- **1K a 10K:** pista com o número de colunas do mapa.
- **Mapas de dupla** (`SpecialStyle`, ou 12K a 18K com duas mãos): pista dividida em dois blocos.
- **Teclas padrão por K:** seguem o layout comum da comunidade (por exemplo, 4K = D F J K; 7K = S D F Espaço J K L), e cada K pode ser reconfigurado nas configurações do Mania.
- **Celular:** a tela vira colunas de toque. Acima de 7K, aparece um aviso de que o mapa é difícil de jogar no toque.

### 7.3 Velocidade de rolagem

- **Rolagem fixa:** o jogador escolhe a velocidade de rolagem, que é constante em milissegundos, independente do BPM, como no mania.
- **SV do mapa:** pode ser ligado ou desligado. A opção é só visual e não muda o julgamento.

---

## 8. Regras da partida (motor do Mania)

### 8.1 Janelas de julgamento

As janelas dependem do OD do mapa (valores do mania, em milissegundos, ± em volta do tempo da nota):

| Julgamento | Janela | Peso na precisão |
|---|---|---|
| MAX | 16 | 305 |
| 300 | 64 − 3 × OD | 300 |
| 200 | 97 − 3 × OD | 200 |
| 100 | 127 − 3 × OD | 100 |
| 50 | 151 − 3 × OD | 50 |
| Miss | 188 − 3 × OD (toque cedo demais) ou nota que passou | 0 |

- **Mods que mudam as janelas:** HR multiplica o OD por 1,4 (máximo 10) e EZ por 0,5. Na prática, as janelas ficam mais estreitas no HR e mais largas no EZ.
- **Mods de velocidade:** com DT e HT, as janelas ficam no tempo da música, como no mania.
- **Valores conferidos:** os valores exatos são conferidos com mapas reais antes de fechar o PR do motor e ficam documentados nos testes de paridade.

### 8.2 Notas longas

- **Cabeça:** julgada como uma nota.
- **Ponta:** julgada ao soltar, com janelas mais largas.
- **Soltar cedo demais:** quebra o combo e conta como erro na ponta.
- **Segurar além da ponta:** é permitido.

### 8.3 Pontuação, precisão e nota

- **Precisão** = Σ(peso do julgamento) / (305 × total de julgamentos) × 100.
- **Pontuação:** até 1.000.000, multiplicada pelos mods de redução (EZ, NF, HT). Mods de aumento não aumentam além disso, como no mania atual.
- **Notas:**

| Nota | Precisão |
|---|---|
| SS | 100% |
| S | 95% ou mais |
| A | 90% ou mais |
| B | 80% ou mais |
| C | 70% ou mais |
| D | Menos de 70% |

### 8.4 Vida

- **Drenagem:** pelo `HPDrainRate`. Os acertos recuperam vida e os erros tiram.
- **Vida zerada:** é derrota, a menos que o mod NF esteja ativo.

### 8.5 Mods

| Mod | Efeito | Ranking |
|---|---|---|
| EZ | Janelas mais largas, mais vida | Sim (pontuação reduzida) |
| NF | Sem derrota | Sim (pontuação reduzida) |
| HT | Música a 0,75x | Sim (pontuação reduzida) |
| HR | Janelas mais estreitas | Sim |
| DT / NC | Música a 1,5x | Sim |
| SD / PF | Falha no primeiro erro / no primeiro não-MAX | Sim |
| FI / HD / FL | Esconde as notas perto da linha / do topo / fora do foco | Sim |
| Mirror | Espelha as colunas | Sim |
| Random | Embaralha as colunas (semente gravada no replay) | Não |
| Autoplay | O jogo toca sozinho | Não |

### 8.6 Determinismo

- **Tempo quantizado:** o motor usa o tempo quantizado do Rock (o mesmo tick), para o replay reproduzir a partida exata.
- **Random:** usa um gerador com semente, e a semente vai no replay.
- **Paridade:** o `tests/paridade.json` do Mania é conferido pelo TypeScript (WASM) e pelo Rust, igual ao Rock.

---

## 9. Busca e download

### 9.1 Espelhos

- **Lista ordenada em `mania/busca/espelhos.ts`:** catboy.best, nerinyan.moe e osu.direct.
- **Tradutor:** cada espelho tem um tradutor da resposta para o nosso tipo `MapaDaBusca` (título, artista, mapper, status, dificuldades com K, estrelas e nome).
- **Troca automática:** se um espelho der erro ou passar de 5 s, o app tenta o próximo. Um espelho que falhou fica de lado por alguns minutos.
- **Todos fora do ar:** a tela mostra uma mensagem clara e um botão para tentar de novo.

### 9.2 Filtros da busca

- **Filtros:** modo mania (fixo), número de teclas, status (ranked, loved, qualified, todos), faixa de estrelas, texto e ordenação.
- **Prévia:** antes de baixar, a prévia do áudio toca pelo endereço de prévia do espelho.

### 9.3 Download e importação

1. Baixar o `.osz` direto do espelho, com barra de progresso e opção de cancelar.
2. Descompactar no app, com um limite de tamanho por arquivo para evitar zip-bomb.
3. Ler cada `.osu` e descartar os que não são mania.
4. Salvar áudio, fundo e `.osu` na biblioteca do Mania, que é separada da biblioteca do Rock.
5. Calcular o md5 de cada `.osu`, que identifica a versão para o ranking.

- **Importação manual:** arrastar um `.osz` para o app também funciona. Mapas importados assim ficam como "não conferidos" e rendem 0 XP.
- **Sem repetição:** um mapa já baixado não é pedido de novo ao espelho.

### 9.4 Plataformas

- **Desktop:** usa o HTTP nativo do Tauri, sem CORS.
- **Web e celular:** só os espelhos que liberam CORS. Os que não liberam ficam marcados como "só desktop" na lista. Isso é conferido em teste manual antes da fase 3.

### 9.5 Boas práticas com os espelhos

- **Identificação:** um `User-Agent` que identifica o Riff Rush, quando a plataforma permite.
- **Intervalo entre buscas:** de 300 ms na digitação.
- **Sem pedidos em segundo plano:** o app nunca pede nada em massa sozinho.
- **Crédito:** a tela de resultado e a de seleção mostram o mapper e o link do mapa no osu!.

---

## 10. API

### 10.1 Rejulgamento

- **Replay:** o replay do Mania tem um byte de modo, para a fila saber qual motor usar, mais `beatmap_id`, o md5 do `.osu`, os mods e a semente do Random.
- **Fila:** a fila atual (`partidas_pendentes`) ganha a coluna `modo`.
- **Trabalhador:** despacha para o motor certo.

### 10.2 Chart do osu!

- **Porta `BeatmapsDoOsu`:** recebe `beatmap_id` e md5 e devolve `.osu` e status.
- **Adaptador `catalogo/osu.rs`:**
  - baixa o texto do `.osu` do site oficial;
  - confere se o md5 bate;
  - consulta o status pela API oficial, com um token de app (client credentials) que fica só no servidor.
- **Cache:** tabela `beatmaps_do_osu` (beatmap_id, md5, status, conteúdo, baixado_em), guardada para sempre para os mapas ranked e loved.
- **Limitador:** reaproveita `pedidos_ao_encore`, que passa a ter a coluna `origem`, ou ganha uma tabela gêmea. O limite é de no máximo 60 pedidos por minuto ao osu!.
- **Variáveis novas no `.env.example`:** `OSU_CLIENT_ID` e `OSU_CLIENT_SECRET`.

### 10.3 XP e ranking

- **O que vale:** XP e ranking só para os mapas **ranked e loved**, porque são imutáveis. Os demais e os importados valem 0 XP.
- **XP do Mania:**
  - segue a mesma ideia do Rock (base pela dificuldade × curva da precisão × √notas × repetição);
  - a base vem das estrelas, em faixas;
  - fica em `progresso/dominio.rs` como uma função própria do Mania, e o nível de jogador soma os dois modos.
- **Ranking:**
  - cada dificuldade (`beatmap_id`) tem um top 10;
  - há uma entrada por jogador, ordenada pela pontuação;
  - os mods ficam visíveis em cada linha;
  - o ranking fica separado do Rock, com uma view própria (`recordes_do_mania`).
- **Rotas novas:** no OpenAPI, com os limites validados (tamanho do replay, mods válidos, K entre 1 e 18).

---

## 11. Configurações

- **Gerais (compartilhadas):**
  - áudio, vídeo e idioma;
  - conta;
  - offset de áudio, que é o mesmo dispositivo nos dois modos;
  - o Mania pode ter um ajuste fino extra.
- **Do Rock:** as de hoje (velocidade, sem falha, tema da pista…).
- **Do Mania:**
  - velocidade de rolagem;
  - teclas por K;
  - rolagem para cima ou para baixo;
  - SV ligado ou desligado;
  - mostrar ou não os julgamentos MAX/300;
  - posição da linha de julgamento;
  - largura das colunas.
- **Na tela de configurações:** ela mostra as abas do modo ativo, mais as gerais.

---

## 12. Plano de entrega (fases e PRs)

Cada PR parte da `main` atualizada, aponta para a `main` e segue TDD. O Mania fica atrás da flag `VITE_MODO_MANIA` até a fase 7.

### Fase 0: preparação
- **PR 0.1:** este documento.

### Fase 1: base dos dois modos
- **PR 1.1, `refactor: move o jogo atual para modules/rock`:**
  - só move pastas e atualiza imports;
  - todos os testes passam iguais.
- **PR 1.2, `feat: modo ativo e contrato de cada modo`:**
  - `app/modo.ts`, o contrato `ModoDeJogo` e o `App.tsx` montando as telas pelo modo;
  - o Rock é o único registrado.

### Fase 2: temas em tempo de execução
- **PR 2.1, `feat: tema trocado sem recarregar o app`:** `ProvedorDeTema`, `useTema()` e os canvas redesenhando na troca.
- **PR 2.2, `refactor: tira as cores soltas do app`:** as cores de `character`, `stage`, `songs` e da pista vão para o tema, e entra o teste que barra cores novas fora do tema.
- **PR 2.3, `feat: tema claro Riff Rush Mania`:** o tema rosa e branco, a identidade (nome e logo) no tema, o contraste conferido e o `design.md` atualizado.

### Fase 3: beatmaps
- **PR 3.1, `feat: parser de .osu do mania no motor`:** crate `motor-mania` com o parser e testes com mapas reais de exemplo, sem áudio.
- **PR 3.2, `feat: importação de .osz`:** descompactação, biblioteca do Mania e importação manual.

### Fase 4: gameplay
- **PR 4.1, `feat: regras da partida do mania`:** julgamento, notas longas, precisão, pontuação, vida e paridade.
- **PR 4.2, `feat: mods do mania`:** os mods da seção 8.5, com testes de cada efeito.
- **PR 4.3, `feat: tela de jogo do mania`:** pista vertical em canvas, entrada por K, HUD e resultado.
- **PR 4.4, `feat: seleção de mapas do mania`:** seleção de mapa, dificuldade com nome e estrelas, e mods.
- **PR 4.5, `feat: configurações do mania`.**

### Fase 5: busca e download
- **PR 5.1, `feat: busca de mapas do mania por espelhos`:** troca automática, tradutores e filtros.
- **PR 5.2, `feat: download de mapas do mania`:** progresso, cancelamento e cache.

### Fase 6: servidor
- **PR 6.1, `feat: replay do mania`:** formato e envio.
- **PR 6.2, `feat: rejulgamento do mania`:** despacho por modo, porta, adaptador e cache do `.osu`.
- **PR 6.3, `feat: xp e ranking do mania`:** migrações, view, rotas e a tela do ranking.

### Fase 7: lançamento
- **PR 7.1, `feat: alavanca de modo na tela inicial`:** a alavanca, a transição e a remoção da flag.
- **PR 7.2:** landing atualizada com o Riff Rush Mania.
- **Publicação:** PR da `main` para a `producao`.

### Fase 8: depois do lançamento
- Multijogador do Mania na LAN e online, com o contrato do relay ganhando o modo.
- Variações de tema do Mania.
- Leaderboard por mods.

---

## 13. Garantia de que os dois modos continuam independentes

- **Fronteiras de import:**
  - um teste falha se `modules/mania` importar de `modules/rock`, ou o contrário;
  - pode ser feito com a regra `no-restricted-imports` do ESLint ou com um teste que varre os imports.
- **Testes separados:** `npm test -- mania` e `npm test -- rock` rodam sozinhos, e o CI roda os dois.
- **Motores separados:** dois crates com dois jobs no CI. Uma mudança em `motor-mania` não precisa regenerar o WASM do Rock.
- **Banco separado por modo:**
  - as tabelas e views do ranking são distintas;
  - a fila é compartilhada, com coluna de modo;
  - as migrações nunca alteram o comportamento do Rock.
- **Testes de regressão do Rock:** os testes de paridade e os e2e atuais rodam em todo PR do Mania.

---

## 14. Testes

| Camada | O que cobre |
|---|---|
| Unitário (TS) | Parser do `.osz`, tradutores dos espelhos, troca de espelho, dificuldades por estrelas, mods, modo ativo, tema |
| Unitário (Rust) | Parser `.osu` (versões v5–v14, 1K–18K, notas longas, SV), janelas por OD, precisão, pontuação, vida, replay |
| Paridade | Mesmo replay → mesmo resultado no WASM e no Rust, para cada K e para os mods principais |
| Integração (API + Postgres) | Fila com modo, cache do `.osu`, limitador, XP e ranking do Mania separados do Rock |
| e2e | Girar a alavanca troca tema, nome e telas; buscar, baixar e jogar um mapa de exemplo; o Rock continua jogável |
| Visual | Contraste do tema claro e do escuro; captura das duas telas iniciais |

Os mapas de exemplo usados nos testes são criados pela equipe ou têm licença que permite uso. Áudios dos testes são tons gerados, nunca músicas reais.

---

## 15. Riscos e cuidados

| Risco | Mitigação |
|---|---|
| Espelhos saírem do ar | Vários espelhos com troca automática; mensagem clara; mapas já baixados continuam jogáveis |
| Espelho entregar arquivo alterado | O ranking só confia no `.osu` baixado do site oficial e no md5 |
| Termos de uso do osu! e dos espelhos | Ler os termos antes da fase 5; o servidor não hospeda áudio; uso moderado da API oficial; crédito ao mapper |
| Direitos autorais do áudio | O app não redistribui; o jogador baixa direto do espelho; link para o mapa original |
| Tema claro quebrar telas pensadas para o escuro | Fase 2 antes do Mania; teste de contraste; revisão visual de todas as telas nos dois temas |
| Reorganização para `modules/rock` gerar conflitos | PR só de mudança de pastas, mesclado rápido, com aviso aos outros PRs abertos |
| Latência de entrada em 7K+ no celular | Medir na fase 4; aviso para mapas com muitas teclas no toque |
| Diferença de julgamento em relação ao osu! | Testes com mapas reais e valores de referência documentados; a regra é nossa, inspirada no mania |

---

## 16. Critérios de pronto

- [ ] O Rock funciona igual ao de hoje, com toda a suíte atual passando.
- [ ] O Mania joga mapas de 1K a 10K e de dupla, com notas longas, SV e todos os mods da tabela.
- [ ] Busca e download funcionam no desktop, e no celular com os espelhos que liberam CORS.
- [ ] Partidas em mapas ranked e loved são rejulgadas pelo servidor e entram no XP e no ranking do Mania.
- [ ] Todas as cores do app vêm do tema, e o teste barra cores soltas.
- [ ] A alavanca troca tema, nome, logo e telas sem recarregar o app, e a escolha é lembrada.
- [ ] As variáveis novas estão no `.env.example`, as rotas no OpenAPI e as migrações são novas (nenhuma editada).
- [ ] A landing apresenta os dois modos.
