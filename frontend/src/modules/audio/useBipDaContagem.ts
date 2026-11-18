import { useEffect, useRef } from "react";
import { tocarEfeito } from "./efeitos";

/** O bip de cada número do 3, 2, 1 e o agudo do zero, para todos da sala ouvirem a largada no mesmo ritmo. */
export function useBipDaContagem(valor: number, volume: number, ligado: boolean) {
  const anterior = useRef(valor);
  useEffect(() => {
    const antes = anterior.current;
    anterior.current = valor;
    if (!ligado || valor === antes) return;
    if (valor >= 1 && valor <= 3) tocarEfeito("contagem", volume);
    else if (valor <= 0 && antes > 0) tocarEfeito("largada", volume);
    // O volume pode mudar no meio sem ser um número novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, ligado]);
}
