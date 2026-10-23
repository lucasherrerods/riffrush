import { cn } from "@/shared/lib/utils";

interface Props {
  /** De 0 a 1. */
  fracao: number;
  rotulo: string;
  className?: string;
}

export function BarraDeProgresso({ fracao, rotulo, className }: Props) {
  const porcentagem = Math.round(Math.min(Math.max(fracao, 0), 1) * 100);
  return (
    <div
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={porcentagem}
      className={cn("h-2 overflow-hidden rounded-sm bg-superficie", className)}
    >
      <div className="h-full bg-primaria transition-[width] duration-150" style={{ width: `${porcentagem}%` }} />
    </div>
  );
}
