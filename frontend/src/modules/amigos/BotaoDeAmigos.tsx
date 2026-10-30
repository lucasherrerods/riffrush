import { useEffect } from "react";
import { Users } from "lucide-react";
import { useConta } from "@/modules/conta";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { listaDeAmigos } from "./loja";
import { Contador, useAmigos } from "./PainelDeAmigos";

/** De quanto em quanto tempo as listas são buscadas de novo, para os pedidos novos aparecerem. */
const INTERVALO_DAS_LISTAS_MS = 60_000;

/** No cabeçalho: abre a lista de amigos e mostra quantos pedidos esperam resposta. */
export function BotaoDeAmigos({ aberto, aoAlternar }: { aberto: boolean; aoAlternar: () => void }) {
  const { conta } = useConta();
  const { listas } = useAmigos();
  useEffect(() => {
    void listaDeAmigos.recarregar();
    if (!conta) return;
    const intervalo = setInterval(() => void listaDeAmigos.recarregar(), INTERVALO_DAS_LISTAS_MS);
    return () => clearInterval(intervalo);
  }, [conta]);
  if (!conta) return null;
  const pedidos = listas?.recebidos.length ?? 0;
  return (
    <Button variant="ghost" size="icon" aria-label="Amigos" aria-pressed={aberto} onClick={aoAlternar} className={cn("relative", aberto && "bg-superficie-elevada")}>
      <Users />
      {pedidos > 0 && (
        <span className="absolute -top-1 -right-1">
          <Contador valor={pedidos} />
        </span>
      )}
    </Button>
  );
}
