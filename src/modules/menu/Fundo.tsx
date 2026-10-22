import type React from "react";
import { CORES_DAS_PISTAS } from "@/modules/gameplay";
import { cn } from "@/shared/lib/utils";

const PARTICULAS = 24;

/** Holofotes do palco: posição, cor (token do tema), ângulos da varredura e duração em segundos. */
const HOLOFOTES = [
  { esquerda: "12%", cor: "--cor-primaria", de: "-24deg", ate: "8deg", duracao: 7 },
  { esquerda: "36%", cor: "--cor-texto", de: "-10deg", ate: "14deg", duracao: 9 },
  { esquerda: "64%", cor: "--cor-destaque", de: "12deg", ate: "-14deg", duracao: 8 },
  { esquerda: "88%", cor: "--cor-primaria", de: "22deg", ate: "-6deg", duracao: 6 },
];

/** Raio em zigue-zague, desenhado num quadro de 100 × 100. */
const RAIO = "M58 0 L22 52 L44 50 L8 100 L78 38 L54 40 L86 0 Z";

/**
 * Fundo de palco no desenho da logo: holofotes varrendo, anel creme gasto, raios vermelhos,
 * as cinco pistas coloridas convergindo e faíscas subindo.
 * Durante a música as animações param, para a GPU ficar livre para a pista.
 */
export function Fundo({ tocando = false }: { tocando?: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden bg-fundo">
      <div className={cn("absolute inset-0 transition-opacity duration-700", tocando ? "opacity-30" : "opacity-100")}>
        {HOLOFOTES.map((h) => (
          <div
            key={h.esquerda}
            data-parte="holofote"
            className={cn("holofote", tocando && "holofote-parado")}
            style={
              {
                left: h.esquerda,
                "--de": h.de,
                "--ate": h.ate,
                animationDuration: `${h.duracao}s`,
                background: `linear-gradient(to bottom, color-mix(in srgb, var(${h.cor}) 38%, transparent), transparent 78%)`,
              } as React.CSSProperties
            }
          />
        ))}
        {/* Luz batendo no chão do palco. */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[radial-gradient(ellipse_at_bottom,color-mix(in_srgb,var(--cor-primaria)_22%,transparent),transparent_70%)]" />
      </div>
      <div className={cn("absolute inset-0 transition-opacity duration-700", tocando ? "opacity-20" : "opacity-100")}>
        <div className="desgastado absolute top-[10%] left-1/2 size-[440px] -translate-x-1/2 rounded-full border-[28px] border-texto/25 max-md:size-[300px] max-md:border-[18px]" />
        <svg viewBox="0 0 100 100" className="desgastado absolute top-[8%] left-[calc(50%-340px)] size-56 -rotate-12 fill-primaria/80 max-md:left-[2%] max-md:size-32">
          <path d={RAIO} />
        </svg>
        <svg viewBox="0 0 100 100" className="desgastado absolute top-[4%] left-[calc(50%+130px)] size-64 rotate-6 -scale-x-100 fill-primaria/80 max-md:right-[2%] max-md:left-auto max-md:size-36">
          <path d={RAIO} />
        </svg>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="desgastado absolute inset-x-0 bottom-0 h-[32%] w-full opacity-40">
          {CORES_DAS_PISTAS.map((cor, i) => (
            <path key={cor} d={`M${48 + i} 0 L${i * 22 - 4} 40 L${i * 22 + 10} 40 Z`} fill={cor} />
          ))}
        </svg>
      </div>
      <div className="grade-perspectiva absolute inset-x-0 bottom-0 h-[55%]">
        <div data-parte="grade" className={cn("grade-chao", tocando && "grade-parada")} />
      </div>
      {!tocando &&
        Array.from({ length: PARTICULAS }, (_, i) => (
          <span
            key={i}
            data-parte="particula"
            className={cn("particula absolute h-1.5 w-0.5 rotate-12", i % 3 === 0 ? "bg-texto/70" : "bg-primaria")}
            style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.7) % 6}s`, animationDuration: `${5 + (i % 5)}s` }}
          />
        ))}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,color-mix(in_srgb,var(--cor-fundo)_85%,transparent))]" />
    </div>
  );
}
