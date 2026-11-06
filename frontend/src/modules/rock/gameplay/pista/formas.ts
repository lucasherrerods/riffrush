import type { FormatoDaCacapa } from "@/modules/rock/skins";

/**
 * Abre um caminho com o formato da caçapa, centrado em (x, y) e do tamanho da elipse de raios rx e ry.
 * A mesma forma serve para as caçapas e para as notas, vistas em perspectiva.
 */
export function tracarForma(c: CanvasRenderingContext2D, formato: FormatoDaCacapa, x: number, y: number, rx: number, ry: number) {
  c.beginPath();
  if (formato === "retangular") {
    c.roundRect(x - rx, y - ry, rx * 2, ry * 2, Math.min(rx, ry) * 0.35);
    return;
  }
  if (formato === "hexagonal") {
    // Hexágono deitado: pontas na esquerda e na direita, achatado pela perspectiva.
    c.moveTo(x - rx, y);
    c.lineTo(x - rx / 2, y - ry);
    c.lineTo(x + rx / 2, y - ry);
    c.lineTo(x + rx, y);
    c.lineTo(x + rx / 2, y + ry);
    c.lineTo(x - rx / 2, y + ry);
    c.closePath();
    return;
  }
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}
