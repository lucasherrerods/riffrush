import { cn } from "@/shared/lib/utils";

const PARTICULAS = 24;

/**
 * Fundo de palco: sol listrado, grade em perspectiva e partículas subindo.
 * Durante a música as animações param, para a GPU ficar livre para a pista.
 */
export function Fundo({ tocando = false }: { tocando?: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden bg-fundo">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--cor-primaria)_30%,transparent),transparent_60%)]" />
      <div className={cn("sol-listrado absolute top-[18%] left-1/2 size-[420px] -translate-x-1/2 rounded-full transition-opacity duration-700", tocando ? "opacity-15" : "opacity-70")} />
      <div className="grade-perspectiva absolute inset-x-0 bottom-0 h-[55%]">
        <div data-parte="grade" className={cn("grade-chao", tocando && "grade-parada")} />
      </div>
      <div className="absolute inset-x-0 top-[45%] h-px bg-primaria/60" />
      {!tocando &&
        Array.from({ length: PARTICULAS }, (_, i) => (
          <span
            key={i}
            data-parte="particula"
            className="particula absolute size-1 rounded-full bg-texto/70"
            style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.7) % 6}s`, animationDuration: `${5 + (i % 5)}s` }}
          />
        ))}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,color-mix(in_srgb,var(--cor-fundo)_80%,transparent))]" />
    </div>
  );
}
