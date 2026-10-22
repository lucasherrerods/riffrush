import { COR_DA_ESTRELA, COR_DA_NOTA_DE_ESTRELA } from "../cores";
import { SPRITE_DA_NOTA, type Sprites } from "./desenhar";

const CONTORNO = "rgba(243,242,247,0.9)";
const TAMANHO_DO_BRILHO = 256;

function comCanvas(largura: number, altura: number, desenhar: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  desenhar(canvas.getContext("2d")!);
  return canvas;
}

function comTransparencia(hex: string, alfa: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, alfa)})`;
}

/**
 * Notas e brilhos são desenhados uma vez só e reaproveitados em todo frame.
 * O shadowBlur fica aqui, fora do loop, porque é o que mais pesa no canvas 2D.
 */
export function criarSprites(): Sprites {
  const cache = new Map<string, HTMLCanvasElement>();
  const lembrar = (chave: string, criar: () => HTMLCanvasElement) => {
    if (!cache.has(chave)) cache.set(chave, criar());
    return cache.get(chave)!;
  };

  return {
    nota: (cor, estrela, brilho) =>
      lembrar(`nota:${cor}:${estrela}:${brilho}`, () =>
        comCanvas(SPRITE_DA_NOTA.largura, SPRITE_DA_NOTA.altura, (c) => {
          const x = SPRITE_DA_NOTA.largura / 2;
          const y = SPRITE_DA_NOTA.altura / 2 - 6;
          const rx = SPRITE_DA_NOTA.raio;
          const ry = rx * 0.5;
          c.beginPath();
          c.ellipse(x, y + ry * 0.35, rx, ry, 0, 0, Math.PI * 2);
          c.fillStyle = "rgba(18,17,23,0.55)";
          c.fill();

          c.beginPath();
          c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
          c.fillStyle = estrela ? COR_DA_NOTA_DE_ESTRELA : cor;
          if (brilho) {
            c.shadowColor = estrela ? "#7dd3fc" : cor;
            c.shadowBlur = estrela ? 22 : 10;
          }
          c.fill();
          c.shadowBlur = 0;
          c.lineWidth = 4;
          c.strokeStyle = estrela ? COR_DA_ESTRELA : CONTORNO;
          c.stroke();

          c.beginPath();
          c.ellipse(x, y - ry * 0.15, rx * 0.45, ry * 0.4, 0, 0, Math.PI * 2);
          c.fillStyle = "rgba(243,242,247,0.75)";
          c.fill();
        }),
      ),
    brilho: (cor) =>
      lembrar(`brilho:${cor}`, () =>
        comCanvas(TAMANHO_DO_BRILHO, TAMANHO_DO_BRILHO, (c) => {
          const r = TAMANHO_DO_BRILHO / 2;
          const gradiente = c.createRadialGradient(r, r, 0, r, r, r);
          gradiente.addColorStop(0, "rgba(243,242,247,0.95)");
          gradiente.addColorStop(0.35, comTransparencia(cor, 0.6));
          gradiente.addColorStop(1, comTransparencia(cor, 0));
          c.fillStyle = gradiente;
          c.fillRect(0, 0, TAMANHO_DO_BRILHO, TAMANHO_DO_BRILHO);
        }),
      ),
  };
}
