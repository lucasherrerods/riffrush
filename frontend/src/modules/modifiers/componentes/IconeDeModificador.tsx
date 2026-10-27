import { cn } from "@/shared/lib/utils";

/** A placa quadrada do modificador, com a sigla. Ativa, ela clareia e inclina, como uma carta virada. */
export function IconeDeModificador({ sigla, ativo, className }: { sigla: string; ativo: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "chapa relative flex size-20 shrink-0 items-center justify-center overflow-hidden transition-transform duration-200",
        ativo ? "-rotate-6 scale-110 border-destaque bg-superficie-elevada text-texto" : "border-borda bg-superficie text-texto-suave",
        className,
      )}
    >
      {/* O canto dobrado e a linha diagonal imitam o desenho das placas. */}
      <span className="absolute top-0 left-0 size-4 bg-borda [clip-path:polygon(0_0,100%_0,0_100%)]" />
      <span className="absolute right-2 bottom-2 h-px w-3 -rotate-45 bg-texto-suave" />
      <span className="font-titulo text-4xl leading-none tracking-wider">{sigla}</span>
    </span>
  );
}
