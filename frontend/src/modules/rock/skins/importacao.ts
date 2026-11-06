import { SKIN_PADRAO, type SkinDaPista } from "./skins";

/** O Clone Hero aceita PNG e JPG e redimensiona tudo para 512x1024 ao carregar. */
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

/** Como no Clone Hero, qualquer imagem é esticada para 512x1024, a proporção do braço. */
export function medidasDaHighway(_largura: number, _altura: number) {
  return { ...MEDIDAS_DA_HIGHWAY };
}

export function criarSkinDeHighway(nomeDoArquivo: string, imagem: string, agora = Date.now()): SkinDaPista {
  return { id: `highway:${agora.toString(36)}`, nome: nomeDaHighway(nomeDoArquivo), cores: SKIN_PADRAO.cores, highway: imagem };
}

export function adicionarHighway(lista: SkinDaPista[], nova: SkinDaPista) {
  return [nova, ...lista.filter((s) => s.id !== nova.id)].slice(0, LIMITE_DE_HIGHWAYS);
}

export const removerHighway = (lista: SkinDaPista[], id: string) => lista.filter((s) => s.id !== id);

/** Lê o arquivo escolhido e devolve a imagem já em 512x1024, em JPG, para caber no armazenamento do navegador. */
export async function lerHighway(arquivo: File): Promise<SkinDaPista> {
  const erro = validarArquivoDeHighway(arquivo);
  if (erro) throw new Error(erro);
  const bitmap = await createImageBitmap(arquivo);
  const { largura, altura } = medidasDaHighway(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("Não deu para ler a imagem.");
  contexto.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();
  return criarSkinDeHighway(arquivo.name, canvas.toDataURL("image/jpeg", 0.85));
}
