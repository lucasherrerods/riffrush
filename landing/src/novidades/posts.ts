export type Modo = "Rock" | "Mania" | "Rock e Mania";

export interface Post {
  /** Vira a âncora do post na página (/novidades/#id). */
  id: string;
  /** AAAA-MM-DD. */
  data: string;
  titulo: string;
  resumo: string;
  itens: string[];
  modo?: Modo;
}

/** Um post por atualização. O mais novo pode ficar em qualquer lugar: a página ordena pela data. */
export const POSTS: Post[] = [
  {
    id: "previa-na-busca",
    data: "2026-11-13",
    titulo: "Ouça antes de baixar",
    resumo: "A busca agora toca um trecho da música. É só tocar na capa.",
    modo: "Rock e Mania",
    itens: [
      "Na busca de músicas do Rock e de mapas do Mania, a capa toca 20 segundos da música. Toque de novo para parar.",
      "No Rock, a prévia começa no ponto que o charter marcou e baixa só o áudio, sem o pacote inteiro.",
      "A música de fundo do menu baixa o volume enquanto a prévia toca e volta quando ela termina.",
      "Esta página de novidades também é nova: o menu do jogo traz um link para ela.",
    ],
  },
  {
    id: "resultado-do-mania-e-leaderboard",
    data: "2026-11-12",
    titulo: "Gráficos no resultado do Mania",
    resumo: "O fim da partida no Mania ficou mais completo, e o leaderboard ganhou download.",
    modo: "Mania",
    itens: [
      "O resultado do Mania mostra gráficos da partida, e a barra de UR aparece durante o jogo.",
      "A nota longa passa a ser julgada só pela cabeça.",
      "O leaderboard do Mania tem um log de atividades e baixa o mapa direto de lá.",
      "O evento de Natal não troca mais o tema dos modos.",
    ],
  },
  {
    id: "natal-e-celular",
    data: "2026-11-11",
    titulo: "Natal no palco e Mania no celular",
    resumo: "Chegou a decoração de fim de ano, e o Mania passou a funcionar no toque.",
    modo: "Rock e Mania",
    itens: [
      "Versões de evento com tema e decoração de Natal.",
      "O Mania roda no celular, com toque e até 5 teclas.",
      "A seleção no celular tem a roda em tela cheia e uma gaveta com os detalhes.",
      "A Aleatória do Mania filtra por teclas e dificuldade.",
      "A capa da música aparece no fundo de todas as telas do Rock.",
      "As partidas antigas do Rock passaram para o ScoreV1, e o XP foi refeito.",
    ],
  },
  {
    id: "selecao-e-configuracoes",
    data: "2026-11-10",
    titulo: "Seleção mais enxuta e configurações em tela própria",
    resumo: "Menos poluição na hora de escolher a música, e o áudio vale para os dois modos.",
    modo: "Rock e Mania",
    itens: [
      "Os modificadores ficam num popover, e a busca abre em duas colunas.",
      "Um coração no canto da capa favorita a música.",
      "As configurações ganharam uma tela própria, e o volume é o mesmo no Rock e no Mania.",
      "O player da seleção segue o mapa escolhido e volta da partida no ponto certo.",
      "As mensagens privadas são cifradas no banco.",
      "O Rock passou a usar os julgamentos do osu!mania.",
    ],
  },
  {
    id: "amigos-e-chat",
    data: "2026-11-09",
    titulo: "Chat privado e perfil personalizado",
    resumo: "Agora dá para conversar com os amigos e deixar o perfil com a sua cara.",
    modo: "Rock e Mania",
    itens: [
      "Chat privado entre amigos, com histórico e horário das mensagens.",
      "Foto e capa personalizadas no perfil.",
      "No multiplayer, a sequência de acertos dos adversários aparece na tela.",
      "A busca, a seleção e o resultado ficaram iguais nos dois modos.",
      "A busca de mapas do Mania tem paginação.",
    ],
  },
  {
    id: "skins-e-mania-ao-vivo",
    data: "2026-11-06",
    titulo: "Skins da pista e Mania ao vivo",
    resumo: "A pista do Rock pode ser do seu jeito, e dá para assistir partidas do Mania.",
    itens: [
      "Skins da pista do Rock, com importação de highways do Clone Hero.",
      "O menu Customizar muda o formato e as cores das caçapas.",
      "Transmissão ao vivo do Mania e lista de quem está online nos dois modos.",
      "O modo Mania fica sempre ligado.",
    ],
  },
];

export const emOrdem = (posts: Post[]) => [...posts].sort((a, b) => b.data.localeCompare(a.data));

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Montada à mão: `new Date("2026-11-01")` é meia-noite em UTC, que no Brasil ainda é o dia anterior. */
export function formatarData(data: string) {
  const [ano, mes, dia] = data.split("-").map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${ano}`;
}
