import { useCallback, useEffect, useState } from "react";

export type Carregamento<T> = { tipo: "carregando" } | { tipo: "pronto"; dado: T } | { tipo: "erro" };

/** Chama `carregar` ao montar, quando `chave` muda e a cada `tentarDeNovo`. Descarta a resposta de um pedido que já foi trocado. */
export function useCarregamento<T>(carregar: (sinal: AbortSignal) => Promise<T>, chave: unknown = null) {
  const [estado, setEstado] = useState<Carregamento<T>>({ tipo: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const tentarDeNovo = useCallback(() => setTentativa((t) => t + 1), []);

  useEffect(() => {
    const controle = new AbortController();
    setEstado({ tipo: "carregando" });
    carregar(controle.signal)
      .then((dado) => !controle.signal.aborted && setEstado({ tipo: "pronto", dado }))
      .catch(() => !controle.signal.aborted && setEstado({ tipo: "erro" }));
    return () => controle.abort();
    // `carregar` costuma ser criada a cada render; quem pede de novo é a chave ou a tentativa.
  }, [tentativa, chave]);

  return { estado, tentarDeNovo };
}
