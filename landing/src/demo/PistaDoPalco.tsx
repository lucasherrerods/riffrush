import { useEffect, useRef } from "react";
import { comAlfa, temaAtivo } from "@jogo/src/shared/styles/tokens";
import { PISTAS, notasDoRiff, notasNaTela, type Nota } from "./riff";

const CORES = temaAtivo.pista.trastes;
const ANTECEDENCIA = 1600;
/** Altura do alvo, em fração da altura do canvas. */
const ALVO = 0.86;
const NOTAS: Nota[] = notasDoRiff(60000);
const FIM = NOTAS[NOTAS.length - 1].tempo + 1500;

/** Ponto na pista em perspectiva: posição 0 é o fundo, 1 é o alvo. */
function ponto(largura: number, altura: number, posicao: number, pista: number) {
  const y = altura * ALVO * Math.pow(Math.max(0, posicao), 1.6);
  const meia = Math.min(largura, altura * 1.1) * (0.06 + 0.3 * (y / (altura * ALVO)));
  const larguraDaPista = (meia * 2) / PISTAS;
  return { x: largura / 2 - meia + larguraDaPista * (pista + 0.5), y, larguraDaPista };
}

/** A pista do jogo tocando sozinha, como cenário atrás do título. */
export function PistaDoPalco({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const parado = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const acertadas = new Set<number>();
    const brilhos = [0, 0, 0, 0, 0];
    let inicio = performance.now() - (parado ? 4000 : 0);
    let anterior = performance.now();
    let quadro = 0;

    const desenhar = () => {
      const agoraReal = performance.now();
      const passo = (agoraReal - anterior) / 1000;
      anterior = agoraReal;
      const proporcao = window.devicePixelRatio || 1;
      const { clientWidth: largura, clientHeight: altura } = canvas;
      if (canvas.width !== largura * proporcao || canvas.height !== altura * proporcao) {
        canvas.width = largura * proporcao;
        canvas.height = altura * proporcao;
      }
      ctx.setTransform(proporcao, 0, 0, proporcao, 0, 0);
      ctx.clearRect(0, 0, largura, altura);

      let tempo = agoraReal - inicio;
      if (tempo > FIM) {
        inicio = agoraReal;
        acertadas.clear();
        tempo = 0;
      }
      NOTAS.forEach((nota, indice) => {
        if (!acertadas.has(indice) && nota.tempo <= tempo && tempo - nota.tempo < 100) {
          acertadas.add(indice);
          brilhos[nota.pista] = 1;
        }
      });

      // Braço da guitarra.
      const fundo = ponto(largura, altura, 0, 0);
      const base = ponto(largura, altura, 1.15, 0);
      const meiaNoFundo = largura / 2 - (fundo.x - fundo.larguraDaPista / 2);
      const meiaNaBase = largura / 2 - (base.x - base.larguraDaPista / 2);
      const braco = ctx.createLinearGradient(0, 0, 0, base.y);
      braco.addColorStop(0, comAlfa(temaAtivo.cores.superficie, 0));
      braco.addColorStop(0.4, comAlfa(temaAtivo.cores.superficie, 0.8));
      braco.addColorStop(1, temaAtivo.cores.superficieElevada);
      ctx.fillStyle = braco;
      ctx.beginPath();
      ctx.moveTo(largura / 2 - meiaNoFundo, 0);
      ctx.lineTo(largura / 2 + meiaNoFundo, 0);
      ctx.lineTo(largura / 2 + meiaNaBase, base.y);
      ctx.lineTo(largura / 2 - meiaNaBase, base.y);
      ctx.closePath();
      ctx.fill();

      // Trastes que passam, dando a sensação de velocidade.
      const batida = 60000 / 140;
      for (let i = 0; i < 8; i++) {
        const posicao = 1 - ((batida - (tempo % batida) + i * batida) / ANTECEDENCIA);
        if (posicao < 0 || posicao > 1.1) continue;
        const a = ponto(largura, altura, posicao, 0);
        const b = ponto(largura, altura, posicao, PISTAS - 1);
        ctx.strokeStyle = comAlfa(temaAtivo.cores.texto, 0.06 + 0.1 * posicao);
        ctx.lineWidth = 1 + posicao * 2;
        ctx.beginPath();
        ctx.moveTo(a.x - a.larguraDaPista / 2, a.y);
        ctx.lineTo(b.x + b.larguraDaPista / 2, b.y);
        ctx.stroke();
      }

      // Cordas.
      for (let pista = 0; pista < PISTAS; pista++) {
        const a = ponto(largura, altura, 0, pista);
        const b = ponto(largura, altura, 1.15, pista);
        ctx.strokeStyle = comAlfa(CORES[pista], 0.2);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Alvos.
      for (let pista = 0; pista < PISTAS; pista++) {
        const { x, y, larguraDaPista } = ponto(largura, altura, 1, pista);
        const raio = larguraDaPista * 0.34;
        const brilho = brilhos[pista];
        brilhos[pista] = Math.max(0, brilho - passo * 4);
        ctx.shadowColor = CORES[pista];
        ctx.shadowBlur = 8 + brilho * 40;
        ctx.lineWidth = 4;
        ctx.strokeStyle = CORES[pista];
        ctx.fillStyle = comAlfa(temaAtivo.cores.fundo, 0.85);
        ctx.beginPath();
        ctx.ellipse(x, y, raio, raio * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (brilho > 0) {
          ctx.fillStyle = comAlfa(CORES[pista], brilho * 0.5);
          ctx.beginPath();
          ctx.moveTo(x - raio, y);
          ctx.lineTo(x, y - altura * 0.35 * brilho);
          ctx.lineTo(x + raio, y);
          ctx.fill();
        }
      }

      // Notas.
      for (const nota of notasNaTela(NOTAS, tempo, ANTECEDENCIA, acertadas)) {
        const { x, y, larguraDaPista } = ponto(largura, altura, nota.posicao, nota.pista);
        const raio = larguraDaPista * 0.32;
        ctx.shadowColor = CORES[nota.pista];
        ctx.shadowBlur = 18;
        ctx.fillStyle = CORES[nota.pista];
        ctx.beginPath();
        ctx.ellipse(x, y, raio, raio * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = comAlfa(temaAtivo.cores.texto, 0.85);
        ctx.beginPath();
        ctx.ellipse(x, y - raio * 0.08, raio * 0.42, raio * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      if (!parado) quadro = requestAnimationFrame(desenhar);
    };
    quadro = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(quadro);
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
