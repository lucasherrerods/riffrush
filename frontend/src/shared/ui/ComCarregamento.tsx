import { Loader2, RotateCcw } from "lucide-react";
import type { Carregamento } from "@/shared/hooks/useCarregamento";
import { Button } from "./button";

interface Props<T> {
  estado: Carregamento<T>;
  tentarDeNovo: () => void;
  /** O que está sendo carregado, para o leitor de tela e a mensagem de erro: "o perfil". */
  oQue: string;
  children: (dado: T) => React.ReactNode;
}

/** Mostra o carregamento, o erro com "Tentar de novo" ou o conteúdo pronto. */
export function ComCarregamento<T>({ estado, tentarDeNovo, oQue, children }: Props<T>) {
  if (estado.tipo === "carregando") return <Loader2 aria-label={`Carregando ${oQue}`} className="m-auto size-6 animate-spin text-texto-suave" />;
  if (estado.tipo === "erro") {
    return (
      <div className="m-auto flex flex-col items-center gap-4 text-center">
        <p className="text-base text-texto-suave">Não deu para carregar {oQue} agora.</p>
        <Button variant="outline" onClick={tentarDeNovo}>
          <RotateCcw className="opacity-70" /> Tentar de novo
        </Button>
      </div>
    );
  }
  return <>{children(estado.dado)}</>;
}
