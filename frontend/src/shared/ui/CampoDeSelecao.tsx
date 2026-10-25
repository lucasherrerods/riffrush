import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface Opcao<T extends string> {
  id: T;
  rotulo: string;
}

interface Props<T extends string> {
  titulo: string;
  opcoes: Opcao<T>[];
  valor: T;
  aoEscolher: (valor: T) => void;
  className?: string;
}

/** Uma escolha numa lista que abre: o select do navegador, que já funciona com teclado e controle. */
export function CampoDeSelecao<T extends string>({ titulo, opcoes, valor, aoEscolher, className }: Props<T>) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-base font-semibold text-texto-suave">
        {titulo}
      </label>
      <div className="relative">
        <select
          id={id}
          value={valor}
          onChange={(evento) => aoEscolher(evento.target.value as T)}
          className="h-10 w-full min-w-40 appearance-none rounded-md border border-borda bg-superficie pr-10 pl-3 text-base text-texto outline-none hover:bg-superficie-elevada focus-visible:border-primaria"
        >
          {opcoes.map((opcao) => (
            <option key={opcao.id} value={opcao.id} className="bg-superficie text-texto">
              {opcao.rotulo}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-texto-suave opacity-70" aria-hidden />
      </div>
    </div>
  );
}
