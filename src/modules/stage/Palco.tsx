import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/utils";
import { criarPalco, type EstadoDoPalco } from "./cena";

interface Props {
  /** Lido a cada quadro: assim o palco acompanha o relógio da música sem re-renderizar o React. */
  lerEstado: () => EstadoDoPalco;
  className?: string;
  /** Desligado, o palco fica sem o personagem (para aliviar a placa de vídeo). */
  comPersonagem?: boolean;
}

/** Palco 3D com o personagem, desenhado atrás da pista. Só decoração: fica escondido dos leitores de tela. */
export function Palco({ lerEstado, className, comPersonagem = true }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const leitura = useRef(lerEstado);
  leitura.current = lerEstado;

  useEffect(() => {
    if (!canvas.current) return;
    const palco = criarPalco(canvas.current, () => leitura.current(), { comPersonagem });
    return () => palco.descartar();
  }, [comPersonagem]);

  return <canvas ref={canvas} aria-hidden="true" data-parte="palco" className={cn("pointer-events-none absolute inset-0 size-full", className)} />;
}
