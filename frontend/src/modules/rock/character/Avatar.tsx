import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { instrumentoDoPersonagem } from "./catalogo";
import type { Personagem } from "./personagem";
import type { Reacao } from "./reacao";
import type { registrarAvatar } from "./render3d/renderizador";
import { suportaWebGL } from "./render3d/webgl";

interface Props {
  personagem: Personagem;
  className?: string;
  /** Anima tocando no ritmo da música. */
  tocando?: boolean;
  bpm?: number;
  /** Muda a cada nota acertada e dispara uma palhetada. */
  pulso?: number;
  /** Vida baixa deixa o personagem abatido. */
  triste?: boolean;
  /** Reação ao momento da partida; um contador novo dispara de novo. */
  reacao?: Reacao | null;
}

/** Personagem 3D em cel-shading ou filmado. Sem WebGL (ou nos testes) fica só a moldura vazia com o nome. */
export function Avatar({ personagem, className, tocando = false, bpm = 120, pulso = 0, triste = false, reacao = null }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const registro = useRef<ReturnType<typeof registrarAvatar>>(null);
  const [comWebGL] = useState(suportaWebGL);
  const estado = { personagem, tocando, bpm, pulso, triste, reacao };

  const estadoAtual = useRef(estado);
  estadoAtual.current = estado;

  useEffect(() => {
    if (!comWebGL || !canvas.current) return;
    const destino = canvas.current;
    let desmontado = false;
    // O renderizador traz o three.js: só baixa quando um avatar aparece na tela.
    void import("./render3d/renderizador").then(({ registrarAvatar }) => {
      if (!desmontado) registro.current = registrarAvatar(destino, estadoAtual.current);
    });
    // O registro é criado uma vez; as mudanças chegam pelo efeito abaixo.
    return () => {
      desmontado = true;
      registro.current?.remover();
      registro.current = null;
    };
  }, [comWebGL]);

  useEffect(() => {
    registro.current?.atualizar(estado);
  });

  // width/height dão a proporção 3:4, para "w-auto" funcionar com a altura vinda da classe.
  return <canvas ref={canvas} role="img" aria-label={`Personagem ${personagem.nome}`} data-instrumento={instrumentoDoPersonagem(personagem)} data-reacao={reacao?.tipo} width={300} height={400} className={cn("aspect-[3/4]", className)} />;
}
