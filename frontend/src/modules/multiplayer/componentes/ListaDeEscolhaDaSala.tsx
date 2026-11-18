import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export interface ItemDaEscolha {
  id: string;
  rotulo: string;
  /** Nome lido pelo leitor de tela, com a música junto. */
  nomeAcessivel: string;
  /** Estrelas, teclas, o que o modo quiser mostrar à direita. */
  detalhe?: ReactNode;
  escolhido: boolean;
}

export interface GrupoDaEscolha {
  id: string;
  titulo: string;
  subtitulo: string;
  capa: ReactNode;
  duracao?: string;
  itens: ItemDaEscolha[];
}

/** A lista do host no lobby: cada música com a capa, e as dificuldades dela recuadas embaixo. */
export function ListaDeEscolhaDaSala({ rotulo, grupos, aoEscolher }: { rotulo: string; grupos: GrupoDaEscolha[]; aoEscolher: (grupo: string, item: string) => void }) {
  const escolhido = useRef<HTMLButtonElement>(null);
  const idDoEscolhido = grupos.flatMap((g) => g.itens).find((i) => i.escolhido)?.id;
  // Com chaves: no Chrome o scrollIntoView devolve uma Promise, e um efeito só pode devolver a função de limpeza.
  useEffect(() => {
    escolhido.current?.scrollIntoView?.({ block: "nearest" });
  }, [idDoEscolhido]);

  return (
    <div role="radiogroup" aria-label={rotulo} className="rolagem-de-toque flex min-h-48 flex-1 flex-col gap-2 max-md:max-h-48 max-md:min-h-0 max-md:flex-none max-md:overscroll-auto">
      {grupos.map((grupo) => (
        <div key={grupo.id} role="group" aria-label={grupo.titulo} className="flex flex-col gap-1">
          <div className="flex items-center gap-4 px-2 py-1 max-md:gap-2">
            {grupo.capa}
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold">{grupo.titulo}</p>
              <p className="truncate text-sm text-texto-suave">{grupo.subtitulo}</p>
            </div>
            {grupo.duracao && <span className="font-mono text-sm text-texto-suave">{grupo.duracao}</span>}
          </div>
          <div className="ml-16 flex flex-col gap-1 max-md:ml-11">
            {grupo.itens.map((item) => (
              <button
                key={item.id}
                ref={item.escolhido ? escolhido : undefined}
                role="radio"
                aria-checked={item.escolhido}
                aria-label={item.nomeAcessivel}
                onClick={() => aoEscolher(grupo.id, item.id)}
                className={cn("flex items-center gap-4 rounded-lg px-4 py-2 text-left text-base max-md:gap-2 max-md:px-2 max-md:py-1.5 max-md:text-sm", item.escolhido ? "bg-primaria" : "hover:bg-superficie-hover")}
              >
                <span className="flex-1 truncate font-semibold">{item.rotulo}</span>
                {item.detalhe}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** O tamanho da capa que cabe no cabeçalho do grupo. */
export const CLASSE_DA_CAPA_DA_ESCOLHA = "size-12 shrink-0 rounded-md max-md:size-9";
