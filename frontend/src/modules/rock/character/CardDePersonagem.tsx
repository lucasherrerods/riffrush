import { cn } from "@/shared/lib/utils";

interface Props {
  rotulo: string;
  /** Arte vertical 2:3; null mostra só o nome. */
  card: string | null;
  escolhido: boolean;
  aoEscolher: () => void;
  className?: string;
}

/** Card vertical de um personagem, como na escolha de campeão: a arte presa no topo para não cortar a cabeça. */
export function CardDePersonagem({ rotulo, card, escolhido, aoEscolher, className }: Props) {
  return (
    <button
      role="radio"
      aria-checked={escolhido}
      aria-label={rotulo}
      onClick={aoEscolher}
      className={cn(
        "relative aspect-[2/3] overflow-hidden rounded-lg border-2 bg-superficie transition-colors",
        escolhido ? "border-primaria" : "border-borda hover:border-texto-suave",
        className,
      )}
    >
      {card && <img src={card} alt="" draggable={false} className="absolute inset-0 size-full object-cover object-top" />}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-fundo via-fundo/80 to-transparent px-2 pt-8 pb-2 text-center font-titulo text-base uppercase">
        {rotulo}
      </span>
    </button>
  );
}
