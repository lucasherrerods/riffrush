import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

/** Botão das ações da seleção (buscar, importar, aleatória), igual nos dois modos. O ícone dentro dele leva a cor primária. */
export function BotaoDaSelecao({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button variant="secondary" className={cn("chapa h-10 rounded-none border-borda bg-superficie-elevada [&_svg]:text-primaria [&_svg]:opacity-100", className)} {...props} />;
}
