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
    <div className="flex items-center justify-between gap-8 rounded-lg bg-superficie-elevada px-4 py-4">
      <div>
        <Label htmlFor={para} className="text-base font-semibold">
          {rotulo}
        </Label>
        {dica && <p className="mt-1 text-base text-texto-suave">{dica}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-4">{children}</div>
    </div>
  );
}
