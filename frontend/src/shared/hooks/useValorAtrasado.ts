import { useEffect, useState } from "react";

/** Devolve o valor só depois que ele fica parado por `atrasoMs` (debounce). */
export function useValorAtrasado<T>(valor: T, atrasoMs: number): T {
  const [atrasado, setAtrasado] = useState(valor);

  useEffect(() => {
    const espera = setTimeout(() => setAtrasado(valor), atrasoMs);
    return () => clearTimeout(espera);
  }, [valor, atrasoMs]);

  return atrasado;
}
