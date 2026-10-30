import { useEffect, useRef, useState } from "react";

export const INTERVALO_DE_VERIFICACAO = 60 * 60 * 1000;

/** Uma atualização já baixada, esperando o jogador aceitar o reinício. */
export interface AtualizacaoPronta {
  versao: string;
  instalar: () => Promise<void>;
}

export type Buscador = () => Promise<AtualizacaoPronta | null>;

interface Opcoes {
  emPartida: boolean;
  buscar: Buscador;
  avisar: (versao: string, reiniciar: () => Promise<void>) => void;
}

/** Procura atualização ao abrir e a cada hora, baixa sozinha e só avisa fora da partida. */
export function useAtualizacao({ emPartida, buscar, avisar }: Opcoes) {
  const [pronta, setPronta] = useState<AtualizacaoPronta | null>(null);
  const avisou = useRef(false);

  useEffect(() => {
    if (pronta) return;
    let vivo = true;
    const procurar = () =>
      buscar()
        .then((achada) => vivo && achada && setPronta(achada))
        .catch(() => {});
    void procurar();
    const relogio = setInterval(procurar, INTERVALO_DE_VERIFICACAO);
    return () => {
      vivo = false;
      clearInterval(relogio);
    };
  }, [buscar, pronta]);

  useEffect(() => {
    if (!pronta || emPartida || avisou.current) return;
    avisou.current = true;
    avisar(pronta.versao, pronta.instalar);
  }, [pronta, emPartida, avisar]);
}
