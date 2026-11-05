import { useCallback, useEffect, useRef, useState } from "react";
import type { TrocaDeModo } from "@/modules/menu";
import { DURACAO_DO_GIRO_MS } from "@/shared/ui/volvelle/geometria";
import type { Modo } from "./modo";

export interface GiroDeModo extends TrocaDeModo {
  de: Modo;
  para: Modo;
  /** Já começou a girar: o modo novo está montado e o disco vai para o destino. */
  girou: boolean;
}

interface Opcoes {
  trocar: (modo: Modo) => void;
  /** Baixa o código do modo de destino logo no clique. */
  preCarregar: (modo: Modo) => void;
  semMovimento?: boolean;
}

/**
 * A troca de modo pelo disco giratório. No clique, a capa com o modo que sai entra no lugar;
 * no quadro seguinte o modo troca (a tela nova já fica usável por baixo) e o disco gira.
 * Quando a capa sai da tela, a troca acaba. Sem movimento, a troca é na hora.
 */
export function useTrocaDeModo(modo: Modo, { trocar, preCarregar, semMovimento = false }: Opcoes) {
  const [giro, setGiro] = useState<GiroDeModo | null>(null);
  const esperas = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => esperas.current.forEach(clearTimeout), []);

  const pedir = useCallback(
    (para: Modo) => {
      if (giro || para === modo) return;
      if (semMovimento) return trocar(para);
      preCarregar(para);
      setGiro({ de: modo, para, sentido: para === "mania" ? 1 : -1, fase: "chegando", girou: false });
      // Um quadro com a capa já montada na posição de partida, para o giro sair dela.
      esperas.current.push(
        setTimeout(() => {
          trocar(para);
          setGiro((atual) => atual && { ...atual, girou: true });
        }, 34),
        setTimeout(() => setGiro(null), 34 + DURACAO_DO_GIRO_MS + 50),
      );
    },
    [giro, modo, semMovimento, trocar, preCarregar],
  );

  return { giro, pedir };
}
