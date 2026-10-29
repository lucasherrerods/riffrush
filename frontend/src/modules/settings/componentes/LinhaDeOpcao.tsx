import type { ReactNode } from "react";
import { Label } from "@/shared/ui/label";

interface Props {
  rotulo: string;
  dica?: string;
  /** id do controle, para o rótulo dar nome a ele (acessibilidade). */
  para?: string;
  children: ReactNode;
}

export function LinhaDeOpcao({ rotulo, dica, para, children }: Props) {
  return (
    <div className="flex items-center justify-between gap-8 rounded-lg bg-superficie-elevada px-4 py-2 max-md:gap-3 max-md:px-3 max-md:py-1.5">
      <div>
        <Label htmlFor={para} className="text-base font-semibold max-md:text-sm">
          {rotulo}
        </Label>
        {dica && <p className="text-base text-texto-suave max-md:text-xs">{dica}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-4 max-md:gap-2">{children}</div>
    </div>
  );
}
