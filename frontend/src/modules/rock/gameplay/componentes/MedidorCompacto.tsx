import { cn } from "@/shared/lib/utils";

interface Props {
  vida: number;
  estrela: number;
  estrelaAtiva?: boolean;
  className?: string;
}

const PINOS = 4;

/** Medidor do celular: quatro pinos do star power em cima e a vida numa barra com as quinas cortadas. */
export function MedidorCompacto({ vida, estrela, estrelaAtiva = false, className }: Props) {
  const apagada = `${Math.round((1 - vida) * 100)}%`;
  return (
    <div className={cn("flex flex-col items-stretch gap-1", className)}>
      <div role="progressbar" aria-label="Star power" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(estrela * 100)} className={cn("flex justify-center gap-1.5", estrelaAtiva && "pulso-suave")}>
        {Array.from({ length: PINOS }, (_, i) => {
          const cheio = Math.min(1, Math.max(0, estrela * PINOS - i));
          return (
            <span key={i} data-testid="pino" data-cheio={cheio >= 1 ? "1" : "0"} className="relative h-3 w-5 overflow-hidden rounded-sm border border-borda bg-fundo">
              <span className="absolute inset-y-0 left-0 bg-estrela" style={{ width: `${cheio * 100}%` }} />
            </span>
          );
        })}
      </div>
      {/* A moldura tem as quinas cortadas do botão principal; o degradê fica parado e a parte apagada cobre o que falta. */}
      <div role="meter" aria-label="Vida" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(vida * 100)} className="bg-borda p-[2px] [clip-path:polygon(7px_0,100%_0,100%_calc(100%-7px),calc(100%-7px)_100%,0_100%,0_7px)]">
        <div className="relative h-3.5 overflow-hidden bg-fundo [clip-path:polygon(6px_0,100%_0,100%_calc(100%-6px),calc(100%-6px)_100%,0_100%,0_6px)]">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--cor-perigo),var(--cor-destaque),var(--cor-ouro),var(--cor-sucesso))]" />
          <div className="absolute inset-y-0 right-0 bg-fundo transition-[width] duration-200" style={{ width: apagada }} />
        </div>
      </div>
    </div>
  );
}
