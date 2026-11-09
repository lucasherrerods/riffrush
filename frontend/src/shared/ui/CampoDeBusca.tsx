import { Search } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Input } from "./input";

/** O campo de busca das telas: fundo sólido e ícone, para se ler sobre os fundos animados. */
export function CampoDeBusca({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <div className={cn("relative min-w-48 flex-1", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-suave" aria-hidden />
      <Input
        type="search"
        className="chapa h-10 rounded-none border-borda bg-superficie-elevada pl-10 text-base text-texto placeholder:text-texto-suave md:text-base dark:bg-superficie-elevada"
        {...props}
      />
    </div>
  );
}
