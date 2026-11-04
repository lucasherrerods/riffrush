import { useCallback, useEffect, useRef, useState } from "react";
import type { TrocaDeModo } from "@/modules/menu";
import { DURACAO_DO_GIRO_MS } from "@/shared/ui/volvelle/geometria";
import type { Modo } from "./modo";

/** Quanto tempo as opções do novo modo levam para chegar voando. */
const CHEGADA_MS = 900;

export interface GiroDeModo extends TrocaDeModo {
  de: Modo;
  para: Modo;
}

interface Opcoes {
  trocar: (modo: Modo) => void;
  /** Baixa o código do modo de destino enquanto o disco gira. */
  preCarregar: (modo: Modo) => void;
  semMovimento?: boolean;
}

/**
 * A troca de modo pelo disco giratório: as opções saem voando e o disco começa a girar;
 * quando ele termina a meia volta o modo troca, e as opções do novo modo chegam voando.
 * Sem movimento, a troca é na hora.
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
      const sentido = para === "mania" ? 1 : -1;
      setGiro({ de: modo, para, sentido, fase: "saindo" });
      esperas.current.push(
        setTimeout(() => {
          trocar(para);
          setGiro((atual) => atual && { ...atual, fase: "chegando" });
        }, DURACAO_DO_GIRO_MS),
        setTimeout(() => setGiro(null), DURACAO_DO_GIRO_MS + CHEGADA_MS),
      );
    },
    [giro, modo, semMovimento, trocar, preCarregar],
  );

  return { giro, pedir };
}
