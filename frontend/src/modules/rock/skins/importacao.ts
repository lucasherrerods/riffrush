import type { Recorte } from "./recorte";
import { SKIN_PADRAO, type SkinDaPista } from "./skins";

/** O Clone Hero aceita PNG e JPG e usa 512x1024; aqui o jogador recorta a imagem nessa proporção. */
export const MEDIDAS_DA_HIGHWAY = { largura: 512, altura: 1024 };
export const TAMANHO_MAXIMO_DO_ARQUIVO = 8 * 1024 * 1024;
/** Cada highway fica guardada no navegador, que tem pouco espaço. */
export const LIMITE_DE_HIGHWAYS = 6;

const EXTENSAO = /\.(png|jpe?g)$/i;

/** O erro para mostrar ao jogador, ou `null` se o arquivo serve. */
export function validarArquivoDeHighway(arquivo: { name: string; type: string; size: number }): string | null {
  const imagem = arquivo.type === "image/png" || arquivo.type === "image/jpeg" || (!arquivo.type && EXTENSAO.test(arquivo.name));
  if (!imagem || !EXTENSAO.test(arquivo.name)) return "A highway precisa ser uma imagem PNG ou JPG.";
  if (arquivo.size > TAMANHO_MAXIMO_DO_ARQUIVO) return `A imagem passa de ${TAMANHO_MAXIMO_DO_ARQUIVO / 1024 / 1024} MB.`;
  return null;
}

export function nomeDaHighway(nomeDoArquivo: string) {
  const nome = nomeDoArquivo.replace(EXTENSAO, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return nome || "Highway";
}

export function criarSkinDeHighway(nomeDoArquivo: string, imagem: string, agora = Date.now()): SkinDaPista {
  return { id: `highway:${agora.toString(36)}`, nome: nomeDaHighway(nomeDoArquivo), cores: SKIN_PADRAO.cores, highway: imagem };
}

export function adicionarHighway(lista: SkinDaPista[], nova: SkinDaPista) {
  return [nova, ...lista.filter((s) => s.id !== nova.id)].slice(0, LIMITE_DE_HIGHWAYS);
}

export const removerHighway = (lista: SkinDaPista[], id: string) => lista.filter((s) => s.id !== id);

/** Uma imagem escolhida pelo jogador, pronta para ser recortada. */
export interface ImagemAberta {
  nome: string;
  url: string;
  largura: number;
  altura: number;
  fonte: CanvasImageSource;
}

/** Abre qualquer PNG ou JPG; o jogador escolhe depois o pedaço que vira a highway. */
export async function abrirImagem(arquivo: File): Promise<ImagemAberta> {
  const erro = validarArquivoDeHighway(arquivo);
  if (erro) throw new Error(erro);
  const fonte = await createImageBitmap(arquivo);
  return { nome: arquivo.name, url: URL.createObjectURL(arquivo), largura: fonte.width, altura: fonte.height, fonte };
}

/** Corta o pedaço escolhido e guarda em 512x1024, em JPG, para caber no armazenamento do navegador. */
export async function recortarHighway(imagem: ImagemAberta, recorte: Recorte): Promise<SkinDaPista> {
  const { largura, altura } = MEDIDAS_DA_HIGHWAY;
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("Não deu para ler a imagem.");
  contexto.drawImage(imagem.fonte, recorte.x, recorte.y, recorte.largura, recorte.altura, 0, 0, largura, altura);
  return criarSkinDeHighway(imagem.nome, canvas.toDataURL("image/jpeg", 0.85));
}
