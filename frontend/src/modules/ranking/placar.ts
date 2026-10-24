import type { RespostaDoRanking } from "./api";

export interface LinhaDoPlacar {
  /** Fica igual enquanto a linha troca de lugar, para a animação acompanhar. */
  id: string;
  nome: string;
  avatar: string | null;
  pontos: number;
  /** Posição no ranking global contando você; null quando não dá para saber (você abaixo do top). */
  posicao: number | null;
  /** A sua pontuação desta partida, ao vivo. */
  voce: boolean;
  /** O seu recorde anterior, que também dá para ultrapassar. */
  recorde: boolean;
}

/** Além do primeiro, as linhas em volta de você: duas acima e uma abaixo, completando com quem vem embaixo. */
const LINHAS_EM_VOLTA = 4;
const ACIMA = 2;

/** As pontuações que você enfrenta: o top e o seu recorde anterior, sem repetir quando ele já está no top. */
function adversarios({ top, meu }: RespostaDoRanking) {
  return [...top, ...(meu && !top.some((l) => l.posicao === meu.posicao) ? [meu] : [])];
}

/** Empatar não basta: quem já tinha os mesmos pontos fica na frente. */
export function pontuacoesAcima(ranking: RespostaDoRanking, pontos: number) {
  return adversarios(ranking).filter((l) => l.pontos >= pontos);
}

/** O placar da partida, como no osu!: o ranking da música com você subindo nele ao vivo. */
export function montarPlacar(ranking: RespostaDoRanking, pontos: number, nome: string): LinhaDoPlacar[] {
  const { meu, jogadores } = ranking;
  const outros = adversarios(ranking);
  const acima = pontuacoesAcima(ranking, pontos);
  // A posição só é certa quando todos acima de você são conhecidos: 1, 2, ..., k sem buraco.
  const contiguos = acima.every((l) => l.posicao <= acima.length);
  const seguinteConhecido = outros.some((l) => l.posicao === acima.length + 1);
  const minhaPosicao = contiguos && (acima.length >= jogadores || seguinteConhecido) ? acima.length + 1 : null;

  const linhas: LinhaDoPlacar[] = [
    ...outros.map((l) => ({
      id: `${l.posicao}`,
      nome: l.nome,
      avatar: l.avatar,
      pontos: l.pontos,
      // Quem você já passou desce uma posição.
      posicao: l.pontos < pontos ? l.posicao + 1 : l.posicao,
      voce: false,
      recorde: !!meu && l.posicao === meu.posicao,
    })),
    { id: "voce", nome, avatar: null, pontos, posicao: minhaPosicao, voce: true, recorde: false },
  ].sort((a, b) => b.pontos - a.pontos || Number(a.voce) - Number(b.voce));

  const indice = linhas.findIndex((l) => l.voce);
  const inicio = Math.max(0, indice - ACIMA);
  const janela = linhas.slice(inicio, inicio + LINHAS_EM_VOLTA);
  return inicio > 0 ? [linhas[0], ...janela] : janela;
}
