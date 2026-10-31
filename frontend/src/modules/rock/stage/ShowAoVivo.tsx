import { useEffect, useRef, type CSSProperties } from "react";
import { cores } from "@/modules/rock/tema";
import type { EstadoDoPalco } from "./cena";
import { ambienteDoShow } from "./direcao";

interface Props {
  /** Lido a cada quadro, como no palco 3D: o clima muda sem re-renderizar o React. */
  lerEstado: () => EstadoDoPalco;
}

const PARTICULAS = 14;
const LUZES_DA_PLATEIA = 18;

// Silhuetas da plateia: cabeças e alguns braços levantados, desenhadas uma vez.
const PLATEIA = Array.from({ length: 26 }, (_, i) => {
  const x = i * 40 + ((i * 37) % 17);
  const y = 34 + ((i * 53) % 14);
  const braco = i % 4 === 1 ? `M${x + 8} ${y + 6} L${x + 18} ${y - 26} L${x + 23} ${y - 24} L${x + 14} ${y + 8} Z` : "";
  return `M${x} 120 L${x} ${y + 18} Q${x} ${y + 10} ${x + 10} ${y + 10} A12 12 0 1 1 ${x + 22} ${y + 10} Q${x + 32} ${y + 10} ${x + 32} ${y + 18} L${x + 32} 120 Z ${braco}`;
}).join(" ");

const variaveisDeCor = {
  "--show-a": cores.primaria,
  "--show-b": cores.destaque,
  "--show-estrela": cores.estrela,
  "--show-fundo": cores.fundo,
  "--show-texto": cores.texto,
} as CSSProperties;

/**
 * Camadas de show ao vivo por cima do palco 3D e atrás da pista: vinheta, refletores, fumaça,
 * partículas, flashes laterais e plateia. Só decoração: não recebe toques nem aparece nos leitores de tela.
 */
export function ShowAoVivo({ lerEstado }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const leitura = useRef(lerEstado);
  leitura.current = lerEstado;

  useEffect(() => {
    const elemento = raiz.current;
    if (!elemento) return;
    let escrito = "";
    let quadro = requestAnimationFrame(function atualizar() {
      quadro = requestAnimationFrame(atualizar);
      const estado = leitura.current();
      const clima = ambienteDoShow(estado);
      const batida = (60 / Math.max(40, estado.bpm)).toFixed(3);
      // Só escreve no DOM quando o clima muda, não a cada quadro.
      const chave = `${clima.luz}|${clima.pulso}|${clima.flashes}|${clima.paleta}|${batida}`;
      if (chave === escrito) return;
      escrito = chave;
      elemento.style.setProperty("--luz", String(clima.luz));
      elemento.style.setProperty("--pulso", String(clima.pulso));
      elemento.style.setProperty("--batida", `${batida}s`);
      elemento.dataset.paleta = clima.paleta;
      elemento.dataset.pulsando = String(clima.pulso > 0);
      elemento.dataset.flashes = String(clima.flashes);
    });
    return () => cancelAnimationFrame(quadro);
  }, []);

  return (
    <div ref={raiz} aria-hidden="true" data-parte="show-ao-vivo" data-paleta="show" className="show-ao-vivo pointer-events-none absolute inset-0 overflow-hidden" style={variaveisDeCor}>
      <div className="show-refletores">
        <div className="show-feixe show-feixe-1" />
        <div className="show-feixe show-feixe-2" />
        <div className="show-feixe show-feixe-3" />
        <div className="show-feixe show-feixe-4" />
      </div>
      <div className="show-fumaca" />
      <div className="show-particulas">
        {Array.from({ length: PARTICULAS }, (_, i) => (
          <span key={i} style={{ left: `${(i * 61) % 100}%`, animationDelay: `${-((i * 1.7) % 9)}s`, animationDuration: `${8 + (i % 5) * 2}s` }} />
        ))}
      </div>
      <div className="show-flash show-flash-esquerda" />
      <div className="show-flash show-flash-direita" />
      <div className="show-vinheta" />
      <div className="show-plateia">
        <svg viewBox="0 0 1040 120" preserveAspectRatio="none">
          <path d={PLATEIA} />
        </svg>
        {Array.from({ length: LUZES_DA_PLATEIA }, (_, i) => (
          <span key={i} style={{ left: `${(i * 47 + 13) % 100}%`, bottom: `${18 + ((i * 29) % 40)}%`, animationDelay: `${-((i * 0.9) % 4)}s` }} />
        ))}
      </div>
    </div>
  );
}
