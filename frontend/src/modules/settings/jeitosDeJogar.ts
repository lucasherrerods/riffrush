import { NOMES_DOS_JEITOS, type JeitoDeJogar } from "@/modules/rock/gameplay";

/** As teclas que a ajuda usa nos exemplos, já com o nome que o jogador configurou. */
export interface TeclasDoExemplo {
  verde: string;
  vermelho: string;
  palheta: string;
}

export interface DescricaoDoJeito {
  id: JeitoDeJogar;
  nome: string;
  resumo: string;
  /** Os parágrafos da ajuda, na ordem. */
  explicacao: (teclas: TeclasDoExemplo) => string[];
}

/** Na ordem em que aparecem nas configurações: do mais simples ao mais parecido com uma guitarra. */
export const JEITOS: DescricaoDoJeito[] = [
  {
    id: "tapping",
    nome: NOMES_DOS_JEITOS.tapping,
    resumo: "Cada aperto toca uma nota",
    explicacao: ({ verde }) => [
      "Aperte o traste no tempo de cada nota. Cada aperto vale uma nota, e só uma.",
      `Notas seguidas na mesma linha pedem um aperto para cada: em duas verdes seguidas, aperte ${verde} duas vezes. Segurar ou soltar a tecla não toca a próxima.`,
      "Nas notas longas, segure o traste até o fim do rastro.",
      "No celular o jogo é sempre assim, porque a tela de toque não tem palheta.",
    ],
  },
  {
    id: "gamepad",
    nome: NOMES_DOS_JEITOS.gamepad,
    resumo: "Soltar também toca a próxima",
    explicacao: ({ verde }) => [
      "Aperte o traste no tempo da nota, como no tapping.",
      `Se a próxima nota for na mesma linha, você pode segurar o traste e soltar no tempo dela: a soltura também conta. Em duas verdes seguidas, aperte ${verde} na primeira e solte na segunda.`,
      "Nas notas longas, segure o traste até o fim do rastro.",
    ],
  },
  {
    id: "palhetada",
    nome: NOMES_DOS_JEITOS.palhetada,
    resumo: "Os trastes acendem, a palheta toca",
    explicacao: ({ verde, vermelho, palheta }) => [
      `Segurar os trastes não toca nada: eles só ficam acesos. Para tocar, aperte a palheta (${palheta}, ou o direcional ▲ ▼ no controle) no tempo da nota.`,
      `Nos acordes, segure todos os trastes e palhete uma vez: segure ${verde} e ${vermelho} e aperte ${palheta} para tocar o verde e o vermelho juntos.`,
      "Os trastes apertados precisam ser exatamente os do acorde: um a mais ou a menos não acerta.",
      "Na nota aberta, palhete sem nenhum traste apertado. Nas notas longas, continue segurando o traste depois de palhetar.",
    ],
  },
];
