import type { TipoDeImagem } from "./api";

/** O tamanho em que cada imagem vai para a API. A capa ocupa o topo do perfil, três vezes mais larga que alta. */
export const MEDIDAS_DA_IMAGEM: Record<TipoDeImagem, { largura: number; altura: number }> = {
  foto: { largura: 256, altura: 256 },
  capa: { largura: 1500, altura: 500 },
};

/** O maior pedaço do centro da imagem com a proporção (largura / altura) pedida. */
export function corteCentral(largura: number, altura: number, proporcao: number) {
  const corte = largura / altura > proporcao ? { largura: Math.round(altura * proporcao), altura } : { largura, altura: Math.round(largura / proporcao) };
  return { x: Math.round((largura - corte.largura) / 2), y: Math.round((altura - corte.altura) / 2), ...corte };
}

/** A foto que a pessoa enviou mora na API; a do Google, não. Só a própria pode ser removida. */
export function ehFotoPropria(avatar: string | null) {
  return !!avatar && /\/contas\/[^/]+\/imagens\/foto/.test(avatar);
}

/** Corta no centro, reduz e converte para WebP antes de enviar, para a API guardar pouco. */
export async function reduzirImagem(arquivo: Blob, tipo: TipoDeImagem): Promise<Blob> {
  const fonte = await createImageBitmap(arquivo);
  const destino = MEDIDAS_DA_IMAGEM[tipo];
  const corte = corteCentral(fonte.width, fonte.height, destino.largura / destino.altura);
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(destino.largura, corte.largura);
  canvas.height = Math.min(destino.altura, corte.altura);
  canvas.getContext("2d")?.drawImage(fonte, corte.x, corte.y, corte.largura, corte.altura, 0, 0, canvas.width, canvas.height);
  fonte.close();
  return new Promise((resolver, rejeitar) =>
    canvas.toBlob((blob) => (blob ? resolver(blob) : rejeitar(new Error("Não deu para ler essa imagem."))), "image/webp", 0.85),
  );
}
