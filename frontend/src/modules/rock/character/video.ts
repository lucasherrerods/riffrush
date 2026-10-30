import { DURACAO_DA_REACAO, type TipoDeReacao } from "./reacao";

/**
 * Personagem de vídeo: uma pessoa de verdade filmada e recortada em folhas de sprites
 * (scripts/preparar-ator.py). Aqui só a lógica: qual cena tocar e qual quadro mostrar.
 */
export type NomeDaCena = "parado" | "tocando" | "errou" | "vaiado" | "nitro" | "vitoria";

export interface CenaDoAtor {
  arquivo: string;
  quadros: number;
  colunas: number;
  linhas: number;
  /** Tamanho de um quadro, em pixels. */
  largura: number;
  altura: number;
}

export interface ManifestoDoAtor {
  nome: string;
  fps: number;
  alturaEmMetros: number;
  /** Só "tocando" é obrigatória; as cenas que faltam usam ela. */
  cenas: Partial<Record<NomeDaCena, CenaDoAtor>> & { tocando: CenaDoAtor };
}

export function dadosDaCena(cenas: ManifestoDoAtor["cenas"], cena: NomeDaCena) {
  const dados = cenas[cena];
  return dados ? { nome: cena, dados } : { nome: "tocando" as NomeDaCena, dados: cenas.tocando };
}

const CENA_DA_REACAO: Record<TipoDeReacao, NomeDaCena> = {
  errou: "errou",
  nitro: "nitro",
  vitoria: "vitoria",
  derrota: "vaiado",
};

/** Cena que o ator mostra agora. Reações tocam uma vez; o resto fica em loop. */
export function cenaDoAtor({ tocando, triste, reacao, desdeReacao }: { tocando: boolean; triste: boolean; reacao: TipoDeReacao | null; desdeReacao: number }) {
  if (reacao && desdeReacao <= DURACAO_DA_REACAO[reacao]) return { cena: CENA_DA_REACAO[reacao], repetir: false };
  if (triste) return { cena: "vaiado" as NomeDaCena, repetir: true };
  return { cena: (tocando ? "tocando" : "parado") as NomeDaCena, repetir: true };
}

export function quadroDaCena(cena: CenaDoAtor, tempo: number, fps: number, repetir: boolean) {
  const quadro = Math.floor(Math.max(0, tempo) * fps);
  return repetir ? quadro % cena.quadros : Math.min(quadro, cena.quadros - 1);
}

/** Pedaço da folha (em coordenadas de textura, de 0 a 1, origem embaixo) onde está o quadro. */
export function recorteDoQuadro(cena: CenaDoAtor, quadro: number) {
  const coluna = quadro % cena.colunas;
  const linha = Math.floor(quadro / cena.colunas);
  return { x: coluna / cena.colunas, y: (cena.linhas - 1 - linha) / cena.linhas, largura: 1 / cena.colunas, altura: 1 / cena.linhas };
}
