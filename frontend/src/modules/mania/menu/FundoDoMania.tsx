import type React from "react";

const TRIANGULOS = 14;
const COLUNAS = 7;

/** Círculos de acerto espalhados, cada um com o anel de aproximação fechando sobre ele. */
const CIRCULOS = [
  { esquerda: "14%", topo: "22%", tamanho: 72, atraso: 0 },
  { esquerda: "84%", topo: "30%", tamanho: 88, atraso: 0.9 },
  { esquerda: "22%", topo: "62%", tamanho: 56, atraso: 1.7 },
  { esquerda: "76%", topo: "66%", tamanho: 64, atraso: 2.4 },
];

/**
 * O palco do Mania no desenho do osu!: fundo claro, triângulos subindo devagar,
 * um anel grande atrás da logo, círculos de acerto com o anel de aproximação
 * e as sete colunas do mania convergindo no chão. Tudo em rosa e branco, do tema.
 */
export function FundoDoMania() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden bg-fundo">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--cor-primaria)_18%,transparent),transparent_65%)]" />

      {Array.from({ length: TRIANGULOS }, (_, i) => (
        <svg
          key={i}
          data-parte="triangulo"
          viewBox="0 0 100 87"
          className={i % 3 === 0 ? "triangulo absolute fill-primaria/15" : "triangulo absolute fill-superficie-elevada"}
          style={
            {
              left: `${(i * 41 + 7) % 100}%`,
              width: `${48 + ((i * 29) % 90)}px`,
              animationDelay: `${-((i * 1.9) % 18)}s`,
              animationDuration: `${16 + (i % 6) * 3}s`,
            } as React.CSSProperties
          }
        >
          <path d="M50 0 L100 87 L0 87 Z" />
        </svg>
      ))}

      {/* O anel grande atrás da logo, que pulsa como o cookie do osu! na batida. */}
      <div className="anel-do-mania absolute top-[10%] left-1/2 size-[440px] -translate-x-1/2 rounded-full border-[26px] border-primaria/25 max-md:size-[300px] max-md:border-[16px]" />
      <div className="absolute top-[calc(10%+38px)] left-1/2 size-[364px] -translate-x-1/2 rounded-full border-2 border-superficie-elevada max-md:top-[calc(10%+26px)] max-md:size-[248px]" />

      {CIRCULOS.map((c) => (
        <div key={c.esquerda} className="absolute max-md:hidden" style={{ left: c.esquerda, top: c.topo, width: c.tamanho, height: c.tamanho }}>
          <div className="absolute inset-0 rounded-full border-4 border-superficie-elevada bg-primaria/70" />
          <div data-parte="aproximacao" className="aproximacao absolute inset-0 rounded-full border-2 border-primaria" style={{ animationDelay: `${c.atraso}s` }} />
        </div>
      ))}

      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[30%] w-full opacity-50">
        {Array.from({ length: COLUNAS }, (_, i) => (
          <path
            key={i}
            data-parte="coluna"
            d={`M${46.5 + i} 0 L${i * 15 - 3} 40 L${i * 15 + 9} 40 Z`}
            className={i % 2 === 0 ? "fill-primaria/40" : "fill-superficie-elevada"}
          />
        ))}
      </svg>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,color-mix(in_srgb,var(--cor-fundo)_80%,transparent))]" />
    </div>
  );
}
