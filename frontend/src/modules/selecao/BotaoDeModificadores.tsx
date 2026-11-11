import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { BotaoDaSelecao } from "./BotaoDaSelecao";

/** Os mods guardados num popover, para não ocuparem a barra da seleção. Mostra quantos estão ligados. */
export function BotaoDeModificadores({ ligados, children }: { ligados: number; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <BotaoDaSelecao>
          <Sparkles aria-hidden />
          <span className="max-md:sr-only">Modificadores</span>
          {ligados > 0 && <span className="font-mono text-primaria">{ligados}</span>}
        </BotaoDaSelecao>
      </PopoverTrigger>
      <PopoverContent collisionPadding={16} className="w-max max-w-[calc(100vw-2rem)]">{children}</PopoverContent>
    </Popover>
  );
}
