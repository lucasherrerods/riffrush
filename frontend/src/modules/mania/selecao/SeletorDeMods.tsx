import { cn } from "@/shared/lib/utils";
import { problemaDosMods } from "../gameplay/motor";
import { MODS, type SiglaDoMod } from "../gameplay/mods";

const NOMES: Record<SiglaDoMod, string> = {
  EZ: "Easy",
  NF: "No Fail",
  HT: "Half Time",
  HR: "Hard Rock",
  DT: "Double Time",
  NC: "Nightcore",
  SD: "Sudden Death",
  PF: "Perfect",
  FI: "Fade In",
  HD: "Hidden",
  FL: "Flashlight",
  MR: "Mirror",
  RD: "Random",
  AT: "Autoplay",
};

/** Os mods que mudam só o desenho ainda não são desenhados; ficam de fora até a pista saber escondê-los. */
const DISPONIVEIS: SiglaDoMod[] = ["EZ", "NF", "HT", "HR", "DT", "NC", "SD", "PF", "MR", "RD"];

/** Ligar um mod desliga os que conflitam com ele, para a combinação ser sempre válida. */
export function alternarMod(mods: number, sigla: SiglaDoMod): number {
  const bit = MODS[sigla];
  if (mods & bit) return mods & ~bit;
  let novos = mods | bit;
  for (const outra of DISPONIVEIS) if (outra !== sigla && novos & MODS[outra] && problemaDosMods(bit | MODS[outra])) novos &= ~MODS[outra];
  return novos;
}

export function SeletorDeMods({ mods, aoMudar }: { mods: number; aoMudar: (mods: number) => void }) {
  return (
    <div role="group" aria-label="Mods" className="flex flex-wrap gap-2">
      {DISPONIVEIS.map((sigla) => {
        const ligado = (mods & MODS[sigla]) !== 0;
        return (
          <button
            key={sigla}
            type="button"
            aria-pressed={ligado}
            title={NOMES[sigla]}
            onClick={() => aoMudar(alternarMod(mods, sigla))}
            className={cn(
              "rounded-md border px-3 py-1.5 font-titulo text-lg tracking-wide transition-colors",
              ligado ? "border-primaria bg-primaria text-texto" : "border-borda bg-superficie-elevada text-texto-suave hover:text-texto",
            )}
          >
            {sigla}
          </button>
        );
      })}
    </div>
  );
}
