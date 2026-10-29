import { useEffect, useState } from "react";
import { sessaoDaConta, useConta } from "@/modules/conta";
import type { Dificuldade, Instrumento } from "@/modules/rock/songs";
import { useValorAtrasado } from "@/shared/hooks/useValorAtrasado";
import { apiDoRanking, type ApiDoRanking, type OrdemDoRanking, type RespostaDoRanking } from "./api";

export interface OpcoesDoRanking {
  api?: Pick<ApiDoRanking, "buscar">;
  /** Espera o pedido parar de mudar antes de buscar: girar o carrossel passa por muitas músicas. */
  atrasoMs?: number;
  lerToken?: () => string | null;
  /** Sem ela, pelos pontos. */
  ordem?: OrdemDoRanking;
}

export type EstadoDoRanking = { tipo: "carregando" } | { tipo: "pronto"; ranking: RespostaDoRanking } | { tipo: "erro" };

/** Busca o ranking da música; descarta respostas de pedidos que já mudaram. */
export function useRanking(musicaId: string, dificuldade: Dificuldade, instrumento: Instrumento, { api = apiDoRanking, atrasoMs = 300, lerToken = () => sessaoDaConta.token(), ordem = "pontos" }: OpcoesDoRanking = {}) {
  // Entrar ou sair da conta muda o recorde pessoal: a conta entra no pedido.
  const contaId = useConta().conta?.id ?? null;
  const pedido = useValorAtrasado(`${musicaId}\n${dificuldade}\n${instrumento}\n${ordem}\n${contaId}`, atrasoMs);
  const [estado, setEstado] = useState<EstadoDoRanking>({ tipo: "carregando" });

  useEffect(() => {
    const [id, dificuldadePedida, instrumentoPedido, ordemPedida] = pedido.split("\n") as [string, Dificuldade, Instrumento, OrdemDoRanking];
    const controle = new AbortController();
    setEstado({ tipo: "carregando" });
    api
      .buscar(id, dificuldadePedida, { instrumento: instrumentoPedido, ordem: ordemPedida, token: lerToken() ?? undefined, sinal: controle.signal })
      .then((ranking) => !controle.signal.aborted && setEstado({ tipo: "pronto", ranking }))
      .catch(() => !controle.signal.aborted && setEstado({ tipo: "erro" }));
    return () => controle.abort();
    // lerToken é lido na hora do pedido; a conta já está na chave do pedido.
  }, [pedido, api]);

  return estado;
}
