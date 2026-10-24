import { useEffect, useState } from "react";
import { sessaoDaConta, useConta } from "@/modules/conta";
import type { Dificuldade, Instrumento } from "@/modules/songs";
import { URL_DA_API } from "@/shared/lib/api";
import { useValorAtrasado } from "@/shared/hooks/useValorAtrasado";
import { criarApiDoRanking, type ApiDoRanking, type RespostaDoRanking } from "./api";

export interface OpcoesDoRanking {
  api?: ApiDoRanking;
  /** Espera o pedido parar de mudar antes de buscar: girar o carrossel passa por muitas músicas. */
  atrasoMs?: number;
  lerToken?: () => string | null;
}

export type EstadoDoRanking = { tipo: "carregando" } | { tipo: "pronto"; ranking: RespostaDoRanking } | { tipo: "erro" };

const apiPadrao = criarApiDoRanking(URL_DA_API);

/** Busca o ranking da música; descarta respostas de pedidos que já mudaram. */
export function useRanking(musicaId: string, dificuldade: Dificuldade, instrumento: Instrumento, { api = apiPadrao, atrasoMs = 300, lerToken = () => sessaoDaConta.token() }: OpcoesDoRanking = {}) {
  // Entrar ou sair da conta muda o recorde pessoal: a conta entra no pedido.
  const contaId = useConta().conta?.id ?? null;
  const pedido = useValorAtrasado(`${musicaId}\n${dificuldade}\n${instrumento}\n${contaId}`, atrasoMs);
  const [estado, setEstado] = useState<EstadoDoRanking>({ tipo: "carregando" });

  useEffect(() => {
    const [id, dificuldadePedida, instrumentoPedido] = pedido.split("\n") as [string, Dificuldade, Instrumento];
    const controle = new AbortController();
    setEstado({ tipo: "carregando" });
    api
      .buscar(id, dificuldadePedida, { instrumento: instrumentoPedido, token: lerToken() ?? undefined, sinal: controle.signal })
      .then((ranking) => !controle.signal.aborted && setEstado({ tipo: "pronto", ranking }))
      .catch(() => !controle.signal.aborted && setEstado({ tipo: "erro" }));
    return () => controle.abort();
    // lerToken é lido na hora do pedido; a conta já está na chave do pedido.
  }, [pedido, api]);

  return estado;
}
