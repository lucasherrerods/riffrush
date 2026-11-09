import { cn } from "@/shared/lib/utils";

const classeDoChip = (ligado: boolean) =>
  cn(
    "rounded-full border-2 px-4 py-1 font-titulo text-base tracking-wide uppercase max-md:px-3 max-md:text-sm",
    ligado ? "border-texto bg-primaria text-texto ring-2 ring-primaria" : "border-borda bg-superficie-elevada text-texto-suave hover:text-texto",
  );

/** Um filtro que liga e desliga sozinho. */
export function Chip({ rotulo, ligado, aoMudar }: { rotulo: string; ligado: boolean; aoMudar: (ligado: boolean) => void }) {
  return (
    <button type="button" aria-pressed={ligado} onClick={() => aoMudar(!ligado)} className={classeDoChip(ligado)}>
      {rotulo}
    </button>
  );
}

/** Opções de escolha única em chips. */
export function GrupoDeChips<T extends string | number>({
  rotulo,
  opcoes,
  valor,
  aoMudar,
}: {
  rotulo: string;
  opcoes: readonly { id: T; rotulo: string }[];
  valor: T;
  aoMudar: (valor: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-2">
      {opcoes.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={valor === o.id} onClick={() => aoMudar(o.id)} className={classeDoChip(valor === o.id)}>
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}
