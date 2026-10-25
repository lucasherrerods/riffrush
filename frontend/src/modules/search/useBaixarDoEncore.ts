import { useState } from "react";
import { avisar } from "@/shared/ui/avisos";
import type { ResultadoDaBusca } from "./encore";

export interface OpcoesDeBaixar {
  comVideo: boolean;
  aoProgredir: (fracao: number) => void;
  /** Mostra o modal de arquivo grande e responde se o jogador quer baixar. */
  confirmarTamanho: (bytes: number) => Promise<boolean>;
}

export type AoBaixar = (resultado: ResultadoDaBusca, opcoes: OpcoesDeBaixar) => Promise<boolean>;

interface Pergunta {
  titulo: string;
  bytes: number;
  responder: (baixar: boolean) => void;
}

/** Um download por vez, com o progresso e a pergunta de arquivo grande. */
export function useBaixarDoEncore(aoBaixar: AoBaixar | undefined, comVideo: boolean) {
  // Um download por vez: poupa o Encore e a memória do celular.
  const [baixando, setBaixando] = useState<{ md5: string; fracao: number } | null>(null);
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);

  const baixar = async (resultado: ResultadoDaBusca) => {
    if (!aoBaixar) return;
    setBaixando({ md5: resultado.md5, fracao: 0 });
    try {
      await aoBaixar(resultado, {
        comVideo,
        aoProgredir: (fracao) => setBaixando({ md5: resultado.md5, fracao }),
        confirmarTamanho: (bytes) => new Promise((responder) => setPergunta({ titulo: resultado.titulo, bytes, responder })),
      });
    } catch (erro) {
      avisar.error(erro instanceof Error ? erro.message : String(erro));
    } finally {
      setBaixando(null);
    }
  };

  const responder = (sim: boolean) => {
    pergunta?.responder(sim);
    setPergunta(null);
  };

  return { baixando, pergunta, baixar, responder };
}
