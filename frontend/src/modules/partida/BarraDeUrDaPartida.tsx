import { useEffect, useRef } from "react";
import { textoDoUr } from "@/modules/resultado";
import { marcasVisiveis, posicaoNaBarra, type LeituraDaBarraDeUr } from "./barraDeUr";

interface Props {
  /** Lida a cada quadro, fora do React: as marcas somem aos poucos. */
  ler: () => LeituraDaBarraDeUr | null;
  /** Uma cor por janela, da mais justa à mais larga. */
  cores: string[];
}

const ALTURA = 28;

/** Embaixo, no centro da tela. Faixas de cada janela (a mais larga por fora), um risco por toque recente, uma seta na média e o UR embaixo. */
export function BarraDeUrDaPartida({ ler, cores }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const texto = useRef<HTMLParagraphElement>(null);
  const atuais = useRef({ ler, cores });
  atuais.current = { ler, cores };

  useEffect(() => {
    const tela = canvas.current;
    const c = tela?.getContext("2d");
    if (!tela || !c) return;
    const corDaLinha = getComputedStyle(tela).getPropertyValue("--cor-texto").trim() || "white";
    let textoEscrito = "";
    let pedido = 0;
    const desenhar = () => {
      pedido = requestAnimationFrame(desenhar);
      const escala = Math.min(window.devicePixelRatio || 1, 2);
      const largura = tela.clientWidth;
      if (tela.width !== Math.round(largura * escala)) {
        tela.width = Math.round(largura * escala);
        tela.height = Math.round(ALTURA * escala);
      }
      c.setTransform(escala, 0, 0, escala, 0, 0);
      c.clearRect(0, 0, largura, ALTURA);
      const ur = atuais.current.ler();
      const proximo = ur?.valor !== undefined ? textoDoUr(ur.valor) : "";
      if (texto.current && proximo !== textoEscrito) texto.current.textContent = textoEscrito = proximo;
      if (!ur) return;
      const { cores } = atuais.current;
      const ultima = ur.janelas.length - 1;
      const limite = ur.janelas[ultima];
      if (!(limite > 0)) return;
      const centro = largura / 2;
      const y = ALTURA - 10;
      const xDe = (desvio: number) => posicaoNaBarra(desvio, limite) * largura;
      c.globalAlpha = 0.4;
      for (let j = ultima; j >= 0; j--) {
        const meia = (Math.min(ur.janelas[j], limite) / limite) * centro;
        c.fillStyle = cores[j];
        c.fillRect(centro - meia, y - 2, meia * 2, 4);
      }
      c.globalAlpha = 1;
      for (const { desvio, alfa } of marcasVisiveis(ur.marcas, ur.agoraMs)) {
        let janela = 0;
        while (janela < ultima && Math.abs(desvio) > ur.janelas[janela]) janela++;
        c.globalAlpha = alfa;
        c.fillStyle = cores[janela];
        c.fillRect(xDe(desvio) - 1, y - 8, 2, 16);
      }
      c.globalAlpha = 1;
      c.fillStyle = corDaLinha;
      c.fillRect(centro - 1, y - 10, 2, 20);
      if (ur.media !== undefined) {
        const xm = xDe(ur.media);
        c.beginPath();
        c.moveTo(xm, y - 11);
        c.lineTo(xm - 5, y - 18);
        c.lineTo(xm + 5, y - 18);
        c.closePath();
        c.fill();
      }
    };
    pedido = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(pedido);
  }, []);

  return (
    <div className="pointer-events-none absolute bottom-1 left-1/2 flex w-[min(80vw,24rem)] -translate-x-1/2 flex-col items-center">
      <canvas ref={canvas} aria-label="Barra de UR" className="w-full" style={{ height: ALTURA }} />
      <p ref={texto} aria-label="UR" className="h-4 font-mono text-xs leading-4 text-texto-suave tabular-nums" />
    </div>
  );
}
