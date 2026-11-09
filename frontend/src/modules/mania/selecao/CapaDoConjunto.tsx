import { useEffect, useState } from "react";
import { Music } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { fonteDaCapa, type ConjuntoSalvo } from "../beatmaps/biblioteca";
import { TeclaDoMania } from "../menu/TeclaDoMania";

/** O endereço da imagem: a URL do site, ou uma URL temporária do fundo guardado, liberada quando sai da tela. */
function useEnderecoDaCapa(conjunto: ConjuntoSalvo) {
  const fonte = fonteDaCapa(conjunto);
  const [endereco, setEndereco] = useState<string | undefined>(typeof fonte === "string" ? fonte : undefined);
  useEffect(() => {
    if (!(fonte instanceof Blob)) return setEndereco(fonte);
    const url = URL.createObjectURL(fonte);
    setEndereco(url);
    return () => URL.revokeObjectURL(url);
  }, [fonte]);
  return endereco;
}

/** A capa do conjunto: o fundo do mapa recortado; sem imagem (ou se ela não carregar), a tecla do Mania. */
export function CapaDoConjunto({ conjunto, className }: { conjunto: ConjuntoSalvo; className?: string }) {
  const endereco = useEnderecoDaCapa(conjunto);
  const [falhou, setFalhou] = useState(false);
  if (!endereco || falhou) return <TeclaDoMania icone={Music} className={cn("size-full", className)} />;
  return <img src={endereco} alt="" draggable={false} onError={() => setFalhou(true)} className={cn("size-full object-cover", className)} />;
}
