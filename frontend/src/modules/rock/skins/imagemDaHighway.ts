import { MEDIDAS_DA_HIGHWAY } from "./importacao";
import { recorteInicial } from "./recorte";
import type { SkinDaPista } from "./skins";

type ImagemNaPista = CanvasImageSource & { width: number; height: number };

/**
 * A imagem que a pista desenha. Carrega em paralelo: até lá a pista mostra o braço do jogo.
 * Nas pistas que precisam de recorte, guarda só o maior pedaço 1:2 do meio, já em 512x1024.
 */
export function imagemDaHighway(skin: SkinDaPista): ImagemNaPista | undefined {
  if (!skin.highway) return undefined;
  const imagem = Object.assign(new Image(), { src: skin.highway });
  if (!skin.recortar) return imagem;
  const canvas = Object.assign(document.createElement("canvas"), { width: 0, height: 0 });
  imagem.onload = () => {
    const r = recorteInicial(imagem.naturalWidth, imagem.naturalHeight);
    canvas.width = MEDIDAS_DA_HIGHWAY.largura;
    canvas.height = MEDIDAS_DA_HIGHWAY.altura;
    canvas.getContext("2d")?.drawImage(imagem, r.x, r.y, r.largura, r.altura, 0, 0, canvas.width, canvas.height);
  };
  return canvas;
}
