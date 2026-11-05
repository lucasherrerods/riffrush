import { ABERTA, ordenar, tocarNota, type EntradaDaDemo, type Roteiro } from "./roteiro";

export type GrupoDoTutorial = "modos" | "mecanicas";

export interface Tutorial {
  id: string;
  grupo: GrupoDoTutorial;
  titulo: string;
  /** Uma frase que resume o tópico, logo abaixo do título. */
  resumo: string;
  /** Os parágrafos da explicação. */
  texto: string[];
  /** Os pontos para lembrar, em lista. */
  dicas?: string[];
  /** A pista em miniatura que mostra a mecânica. Sem ela, o tópico é só texto. */
  demo?: Roteiro;
}

export const GRUPOS: { id: GrupoDoTutorial; titulo: string }[] = [
  { id: "modos", titulo: "Modos de jogo" },
  { id: "mecanicas", titulo: "Mecânicas" },
];

/** Uma escala que sobe e desce nos cinco trastes, a cada `passo` segundos, começando em `inicio`. */
const escala = (inicio: number, passo: number, pistas: (0 | 1 | 2 | 3 | 4)[]) => pistas.map((pista, i) => ({ tempo: inicio + i * passo, pista }));

/** As entradas de quem toca cada nota no gamepad: aperta e solta o traste dela. */
const nosTrastes = (notas: { tempo: number; pista: 0 | 1 | 2 | 3 | 4 }[]): EntradaDaDemo[] => ordenar(...notas.map((n) => tocarNota(n.tempo, n.pista)));

const ESCALA = escala(1.8, 0.4, [0, 1, 2, 3, 4, 3, 2]);

export const TUTORIAIS: Tutorial[] = [
  // ---------- Modos de jogo ----------
  {
    id: "jogar",
    grupo: "modos",
    titulo: "Jogar sozinho",
    resumo: "Escolha a música, a dificuldade e o instrumento, e toque as notas que descem pela pista.",
    texto: [
      "Em Jogar, a roda de músicas mostra a sua biblioteca. Escolha a música, a dificuldade (Fácil, Médio, Difícil ou Expert) e o instrumento: guitarra, baixo, rítmica, guitarra coop ou teclado, quando o chart tiver.",
      "As notas descem pela pista na cor de cada traste. Toque cada uma quando ela passar pela linha de baixo. Quanto mais certinho, melhor o retorno na tela.",
    ],
    dicas: ["As músicas do Encore valem para o ranking e para o XP da conta.", "Arraste arquivos .sng, .chart ou .mid para a janela para importar as suas músicas."],
    demo: {
      duracao: 5,
      notas: ESCALA,
      entradas: nosTrastes(ESCALA),
      legendas: [
        { de: 0, ate: 1.8, texto: "As notas descem pela pista…" },
        { de: 1.8, ate: 4.4, texto: "…e você toca quando elas passam pela linha." },
      ],
    },
  },
  {
    id: "gamepad",
    grupo: "modos",
    titulo: "Jeito de jogar: Gamepad",
    resumo: "Só os trastes: cada aperto toca a nota, e soltar também acerta a próxima nota da mesma pista.",
    texto: [
      "O jeito padrão, para teclado e controle. Não há palheta: apertar o traste já toca a nota.",
      "Em notas rápidas na mesma pista, soltar a tecla depois de um acerto também acerta a próxima nota dela. Assim dá para fazer trechos rápidos apertando e soltando.",
      "No HOPO e no tap vale também o pull-off: segurando um traste de baixo, soltar o de cima toca a nota do de baixo. Veja Âncora em Mecânicas.",
    ],
    dicas: ["É o mesmo modo gamepad do Clone Hero.", "Troque o jeito de jogar em Configurações."],
    demo: {
      duracao: 5,
      notas: [...escala(1.8, 0.4, [0, 1, 2]), { tempo: 3.2, pista: 3 }, { tempo: 3.45, pista: 3 }],
      entradas: ordenar(nosTrastes(escala(1.8, 0.4, [0, 1, 2])), [
        { tempo: 3.12, tipo: "aperta", pista: 3 },
        { tempo: 3.45, tipo: "solta", pista: 3 },
      ]),
      legendas: [
        { de: 1.6, ate: 3, texto: "Apertar o traste toca a nota." },
        { de: 3, ate: 4.4, texto: "Soltar acerta a próxima nota da mesma pista." },
      ],
    },
  },
  {
    id: "tapping",
    grupo: "modos",
    titulo: "Jeito de jogar: Tapping",
    resumo: "Cada aperto vale uma nota, e só uma. Soltar só toca o pull-off do HOPO.",
    texto: [
      "Para quem prefere um toque por nota, como num piano. Bom no celular, onde cada dedo toca uma pista na tela.",
      "A exceção é o pull-off: no HOPO e no tap, segurando um traste de baixo, soltar o de cima toca a nota do de baixo.",
    ],
    demo: {
      duracao: 5,
      notas: escala(1.8, 0.35, [2, 1, 2, 3, 2]),
      entradas: nosTrastes(escala(1.8, 0.35, [2, 1, 2, 3, 2])),
      legendas: [{ de: 1.6, ate: 4, texto: "Um aperto, uma nota." }],
    },
  },
  {
    id: "palhetada",
    grupo: "modos",
    titulo: "Jeito de jogar: Palhetada",
    resumo: "Como a guitarra do Clone Hero: segure os trastes e toque a palheta.",
    texto: [
      "Os trastes só ficam apertados; quem toca a nota é a palheta. Segure o traste (ou o acorde) e palhete quando a nota passar pela linha.",
      "Aqui o HOPO e o tap saem só no traste enquanto as notas comuns pedem a palheta, e palhetar sem nota é palhetada em vão. Veja cada mecânica em Mecânicas.",
    ],
    dicas: ["Escolha a tecla da palheta em Configurações.", "A palheta espera até 50 ms os trastes chegarem: palhetar um tiquinho antes não erra."],
    demo: {
      duracao: 5,
      comPalheta: true,
      notas: escala(1.8, 0.5, [1, 2, 1, 0]),
      entradas: ordenar(...escala(1.8, 0.5, [1, 2, 1, 0]).map((n) => tocarNota(n.tempo, n.pista, { palheta: true, antes: 0.2 }))),
      legendas: [{ de: 1.4, ate: 4, texto: "Segure o traste e toque a palheta." }],
    },
  },
  {
    id: "multiplayer",
    grupo: "modos",
    titulo: "Multiplayer",
    resumo: "Até 4 jogadores: na mesma tela, na rede de casa ou pela internet.",
    texto: [
      "Local: até 4 pistas na mesma tela, cada uma com o seu controle (Multiplayer › Local).",
      "Sala: crie uma sala e os amigos entram pelo código. Na rede de casa, quem está no celular entra pelo navegador e joga na tela do aparelho. Pela internet, a sala funciona igual, com o Online ligado.",
      "Na sala, quem tem a vida zerada não sai da música: vira fantasma e continua tocando, mas a partida dele não vale para o ranking.",
    ],
  },
  {
    id: "online",
    grupo: "modos",
    titulo: "Online, ranking e espectador",
    resumo: "Com a conta, as partidas valem XP e ranking, e os amigos podem assistir ao vivo.",
    texto: [
      "Entre com o Google para ganhar XP e subir de nível. O servidor confere cada partida pelo replay antes de dar o XP, então o resultado é o mesmo para todo mundo.",
      "Cada música tem o próprio ranking por dificuldade, instrumento, jeito de jogar e velocidade. O top 10 guarda o replay: dá para assistir à partida de quem está na frente.",
      "Com Aparecer online ligado, os amigos veem o que você está tocando e podem assistir ao vivo.",
    ],
  },
  {
    id: "treino",
    grupo: "modos",
    titulo: "Treino",
    resumo: "Escolha um trecho da música e repita quantas vezes quiser.",
    texto: ["Na seleção, o botão de treino abre a música por partes. Escolha a parte difícil e toque em laço, sem a vida acabar. O treino não vale para o ranking nem dá XP."],
  },
  {
    id: "modificadores",
    grupo: "modos",
    titulo: "Modificadores e opções",
    resumo: "Velocidade da música, nota aberta, modo sem falha e bot.",
    texto: [
      "Velocidade (nos modificadores da seleção): de 0,5x a 1,5x. A música fica mais lenta ou mais rápida, mas os pontos não mudam: como no Clone Hero, cada velocidade tem o próprio ranking.",
      "Nas Configurações: desligue a nota aberta para ela virar verde; ligue o modo sem falha para a vida nunca acabar; ou ligue o bot para ver a música tocada sozinha.",
    ],
    dicas: ["Com o modo sem falha a partida rende XP, mas fica fora do ranking.", "Com o bot, os recordes não são salvos."],
  },

  // ---------- Mecânicas ----------
  {
    id: "notas",
    grupo: "mecanicas",
    titulo: "Notas e janela de acerto",
    resumo: "Você tem 70 ms antes e 70 ms depois da linha para acertar cada nota.",
    texto: [
      "A nota vale se for tocada até 70 milésimos de segundo antes ou depois de passar pela linha, como no Clone Hero. Fora disso, ela passa como erro.",
      "O retorno na tela diz quão perto você chegou: Perfeito, Ótimo ou Bom. Para os pontos e a porcentagem, todo acerto vale igual.",
    ],
    demo: {
      duracao: 5,
      notas: [
        { tempo: 1.8, pista: 2 },
        { tempo: 2.6, pista: 2 },
        { tempo: 3.4, pista: 2, resultado: "erro" },
      ],
      entradas: ordenar(tocarNota(1.8, 2), tocarNota(2.6, 2, { antes: 0.05 })),
      legendas: [
        { de: 1.4, ate: 3.1, texto: "Na linha: acerto." },
        { de: 3.1, ate: 4.4, texto: "Passou da janela sem tocar: erro." },
      ],
    },
  },
  {
    id: "acordes",
    grupo: "mecanicas",
    titulo: "Acordes",
    resumo: "Duas ou mais notas juntas: aperte todos os trastes do acorde.",
    texto: [
      "Quando várias notas chegam juntas, aperte todos os trastes delas ao mesmo tempo. Na palhetada, o acorde comum pede exatamente esses trastes, nem um a mais.",
      "Cada nota do acorde vale 50 pontos, mas o acorde conta como um só na sequência.",
    ],
    demo: {
      duracao: 5,
      comPalheta: true,
      notas: [
        { tempo: 2, pista: 0 },
        { tempo: 2, pista: 1 },
        { tempo: 3, pista: 1 },
        { tempo: 3, pista: 2 },
        { tempo: 3, pista: 3 },
      ],
      entradas: ordenar(tocarNota(2, 0, { palheta: true, antes: 0.25 }), tocarNota(2, 1, { antes: 0.25 }), ...[1, 2, 3].map((p, i) => tocarNota(3, p as 1 | 2 | 3, { palheta: i === 0, antes: 0.25 }))),
      legendas: [{ de: 1.5, ate: 4, texto: "Todos os trastes do acorde, e a palheta." }],
    },
  },
  {
    id: "aberta",
    grupo: "mecanicas",
    titulo: "Nota aberta",
    resumo: "A barra roxa que cruza a pista: toque sem nenhum traste apertado.",
    texto: ["Na palhetada, solte todos os trastes e palhete. No gamepad e no tapping, ela tem uma tecla própria. Dá para transformar em verde nas Configurações."],
    demo: {
      duracao: 5,
      comPalheta: true,
      notas: [
        { tempo: 2, pista: ABERTA },
        { tempo: 2.6, pista: 1 },
        { tempo: 3.2, pista: ABERTA },
      ],
      entradas: ordenar([{ tempo: 2, tipo: "palheta" }], tocarNota(2.6, 1, { palheta: true, antes: 0.2 }), [{ tempo: 3.2, tipo: "palheta" }]),
      legendas: [{ de: 1.5, ate: 4, texto: "Sem traste nenhum: só a palheta." }],
    },
  },
  {
    id: "sustain",
    grupo: "mecanicas",
    titulo: "Sustain",
    resumo: "A nota com rabo: segure o traste até o fim para ganhar mais pontos.",
    texto: [
      "Depois de tocar a nota, continue segurando o traste enquanto o rabo passa pela linha. Cada batida segurada rende 25 pontos, vezes o multiplicador.",
      "Soltar antes corta o sustain, sem quebrar a sequência. No acorde com sustain, os pontos contam uma vez só.",
    ],
    demo: {
      duracao: 5,
      notas: [{ tempo: 1.8, pista: 2, duracao: 1.6 }],
      entradas: tocarNota(1.8, 2, { duracao: 1.6 }),
      legendas: [
        { de: 1.4, ate: 1.9, texto: "Toque a nota…" },
        { de: 1.9, ate: 3.5, texto: "…e segure até o rabo acabar." },
      ],
    },
  },
  {
    id: "hopo",
    grupo: "mecanicas",
    titulo: "HOPO (hammer-on e pull-off)",
    resumo: "As notas com contorno claro: com a sequência ativa, saem só no traste, sem palheta.",
    texto: [
      "Uma nota simples logo depois de outra, numa pista diferente, costuma virar HOPO. Na palhetada, basta apertar (hammer-on) ou soltar (pull-off) o traste: a nota sai sem palhetar. No gamepad e no tapping, o pull-off também vale: soltar o traste de cima toca o HOPO do traste segurado embaixo.",
      "Só vale com a sequência ativa. Depois de um erro, o próximo HOPO precisa da palheta. Palhetar logo depois de um HOPO não é punido.",
    ],
    dicas: ["Apertar um traste errado acima do HOPO que está chegando faz ele pedir a palheta (anti-ghosting)."],
    demo: {
      duracao: 5,
      comPalheta: true,
      notas: [
        { tempo: 1.8, pista: 0 },
        { tempo: 2.1, pista: 1, tipo: "hopo" },
        { tempo: 2.4, pista: 2, tipo: "hopo" },
        { tempo: 2.7, pista: 1, tipo: "hopo" },
        { tempo: 3, pista: 0, tipo: "hopo" },
      ],
      entradas: ordenar(
        [{ tempo: 1.6, tipo: "aperta", pista: 0 }, { tempo: 1.8, tipo: "palheta" }],
        [
          { tempo: 2.1, tipo: "aperta", pista: 1 },
          { tempo: 2.4, tipo: "aperta", pista: 2 },
          { tempo: 2.7, tipo: "solta", pista: 2 },
          { tempo: 3, tipo: "solta", pista: 1 },
          { tempo: 3.4, tipo: "solta", pista: 0 },
        ],
      ),
      legendas: [
        { de: 1.5, ate: 2, texto: "Palhete a primeira…" },
        { de: 2, ate: 2.55, texto: "…aperte para subir (hammer-on)…" },
        { de: 2.55, ate: 3.4, texto: "…e solte para descer (pull-off)." },
      ],
    },
  },
  {
    id: "tap",
    grupo: "mecanicas",
    titulo: "Tap",
    resumo: "Notas com o centro vazado: saem só no traste, até sem sequência.",
    texto: ["O tap é como o HOPO, mas não precisa de sequência: mesmo depois de um erro, apertar o traste toca a nota. Muito usado em solos rápidos."],
    demo: {
      duracao: 5,
      comPalheta: true,
      notas: [
        { tempo: 1.8, pista: 3, tipo: "tap" },
        { tempo: 2.05, pista: 2, tipo: "tap" },
        { tempo: 2.3, pista: 1, tipo: "tap" },
        { tempo: 2.55, pista: 2, tipo: "tap" },
        { tempo: 2.8, pista: 3, tipo: "tap" },
      ],
      entradas: nosTrastes([
        { tempo: 1.8, pista: 3 },
        { tempo: 2.05, pista: 2 },
        { tempo: 2.3, pista: 1 },
        { tempo: 2.55, pista: 2 },
        { tempo: 2.8, pista: 3 },
      ]),
      legendas: [{ de: 1.5, ate: 3.4, texto: "Só os trastes, sem palheta." }],
    },
  },
  {
    id: "ancora",
    grupo: "mecanicas",
    titulo: "Âncora (anchoring)",
    resumo: "Segure o traste de baixo e toque os de cima: soltar o de cima já toca o de baixo.",
    texto: [
      "Na nota simples, o jogo confere só o traste mais alto apertado. Os trastes abaixo dele podem ficar segurados sem errar.",
      "É assim que se toca o começo de Through the Fire and Flames, que alterna o verde com as outras notas em HOPO. O verde fica segurado o tempo todo: apertar o vermelho é um hammer-on, e soltar o vermelho é um pull-off que já toca o verde, sem apertar o verde de novo.",
      "Vale em todos os jeitos de jogar: no gamepad e no tapping, soltar o traste de cima também toca o HOPO do de baixo. Como no Clone Hero, o acorde HOPO ou tap também aceita âncora: trastes extras abaixo do mais baixo do acorde. No acorde palhetado, não.",
    ],
    dicas: [
      "A âncora só vale para baixo: um traste acima da nota apertado é erro.",
      "Não precisa soltar no tempo exato: soltar o de cima até um pouco antes da nota de baixo chegar já vale, como no Clone Hero.",
      "O pull-off só sai no traste se o de baixo já estiver apertado. Se você soltar tudo, a nota se perde.",
      "O acorde palhetado pede os trastes exatos, e a nota aberta pede todos os trastes soltos.",
    ],
    demo: {
      duracao: 6,
      comPalheta: true,
      notas: [
        { tempo: 1.8, pista: 0 },
        ...([1, 0, 2, 0, 3, 0, 2, 0] as const).map((pista, i) => ({ tempo: 2.1 + i * 0.3, pista, tipo: "hopo" as const })),
      ],
      entradas: ordenar(
        [
          { tempo: 1.5, tipo: "aperta", pista: 0 },
          { tempo: 1.8, tipo: "palheta" },
          { tempo: 4.8, tipo: "solta", pista: 0 },
        ],
        ...([1, 2, 3, 2] as const).map((pista, i) => [
          { tempo: 2.1 + i * 0.6, tipo: "aperta" as const, pista },
          { tempo: 2.4 + i * 0.6, tipo: "solta" as const, pista },
        ]),
      ),
      legendas: [
        { de: 1.4, ate: 2.1, texto: "Palhete o verde e não solte mais." },
        { de: 2.1, ate: 5, texto: "Aperte e solte o de cima: soltar já toca o verde." },
      ],
    },
  },
  {
    id: "em-vao",
    grupo: "mecanicas",
    titulo: "Palhetada em vão (overstrum)",
    resumo: "Palhetar sem nota quebra a sequência, cancela a frase de star power e tira o full combo.",
    texto: [
      "Na palhetada, cada palhetada precisa acertar uma nota. Palhetar no vazio é overstrum: a sequência zera, a frase de star power em andamento se perde e o full combo vai embora.",
      "No gamepad e no tapping, vale o mesmo para o traste apertado sem nota.",
    ],
    demo: {
      duracao: 5,
      comPalheta: true,
      notas: [
        { tempo: 1.8, pista: 1 },
        { tempo: 3.2, pista: 1 },
      ],
      entradas: ordenar(tocarNota(1.8, 1, { palheta: true, antes: 0.2 }), [{ tempo: 2.5, tipo: "palhetaEmVao" }], tocarNota(3.2, 1, { palheta: true, antes: 0.2 })),
      legendas: [{ de: 2.4, ate: 3.1, texto: "Palhetada sem nota: a sequência zera." }],
    },
  },
  {
    id: "sequencia",
    grupo: "mecanicas",
    titulo: "Sequência e multiplicador",
    resumo: "A cada 10 acertos seguidos o multiplicador sobe, até 4x.",
    texto: [
      "Cada nota vale 50 pontos vezes o multiplicador. Ele começa em 1x e sobe para 2x, 3x e 4x a cada 10 acertos seguidos (o acorde conta como um).",
      "Um erro ou uma palhetada em vão zera a sequência e o multiplicador volta para 1x.",
    ],
    demo: {
      duracao: 5,
      notas: escala(1.6, 0.22, [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2]),
      entradas: nosTrastes(escala(1.6, 0.22, [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2])),
      legendas: [{ de: 1.5, ate: 4.2, texto: "10 seguidos: o multiplicador vai para 2x." }],
    },
  },
  {
    id: "estrela",
    grupo: "mecanicas",
    titulo: "Star power",
    resumo: "Acerte todas as notas brancas da frase para encher a barra; ative para dobrar o multiplicador.",
    texto: [
      "As notas brancas e brilhantes formam uma frase de star power. Acertando todas, a barra enche um quarto (2 compassos). Errar uma nota da frase, ou palhetar em vão no meio dela, perde a frase.",
      "Com metade da barra, ative o star power (a tecla da estrela, ou arrastando o dedo para cima no celular). Enquanto dura, o multiplicador dobra e pode chegar a 8x. A barra cheia dura 8 compassos.",
    ],
    demo: {
      duracao: 5,
      notas: [...escala(1.6, 0.35, [1, 2, 3]).map((n) => ({ ...n, estrela: true })), ...escala(3.2, 0.3, [2, 1])],
      entradas: ordenar(nosTrastes(escala(1.6, 0.35, [1, 2, 3])), [{ tempo: 2.7, tipo: "estrela" }], nosTrastes(escala(3.2, 0.3, [2, 1]))),
      legendas: [
        { de: 1.4, ate: 2.5, texto: "Acerte toda a frase branca…" },
        { de: 2.5, ate: 3.9, texto: "…e ative: o multiplicador dobra." },
      ],
    },
  },
  {
    id: "solo",
    grupo: "mecanicas",
    titulo: "Solos",
    resumo: "Os trechos de solo dão um bônus no fim, conforme quantas notas você acertou neles.",
    texto: ["Quando o chart marca um solo, cada nota acertada nele rende um bônus de até 100 pontos no fim do trecho. Abaixo de 60% das notas do solo, não há bônus; com 100%, o bônus é cheio."],
  },
  {
    id: "vida",
    grupo: "mecanicas",
    titulo: "Vida e vaia",
    resumo: "Acertos enchem a vida, erros esvaziam. Com a vida zerada, a plateia vaia e a música acaba.",
    texto: ["A barra de vida começa no meio. Cada acerto sobe um pouco e cada erro (ou toque em vão) desce mais. Zerou, a música para. Com o modo sem falha (nas Configurações), a vida nunca acaba, mas a partida fica fora do ranking."],
  },
  {
    id: "resultado",
    grupo: "mecanicas",
    titulo: "Estrelas, porcentagem e full combo",
    resumo: "Como o resultado é contado no fim da música.",
    texto: [
      "A porcentagem é de notas acertadas sobre as notas da música. O full combo é acertar todas sem nenhuma palhetada ou toque em vão.",
      "As estrelas vêm dos pontos, comparados com a pontuação de quem acerta tudo sem star power: 5 estrelas pedem cerca de 78% dela. O star power, os sustains e os solos ajudam a chegar lá.",
    ],
  },
];
