import { useEffect, useState } from "react";
import type { Musica } from "@/modules/songs";
import { resolverMusica } from "./musicaNaRede";
import type { EstadoDaSala } from "./protocolo";

export type PreparoDaMusica = { tipo: "baixando" } | { tipo: "pronta" } | { tipo: "erro"; mensagem: string };

/**
 * O convidado baixa a música assim que o host escolhe, e não na largada: assim ele só dá pronto
 * quando já pode tocar. A música baixada fica guardada, e a largada usa a mesma.
 */
export function useMusicaDaSala(sala: EstadoDaSala, musicas: Musica[], endereco: string): PreparoDaMusica {
  const [preparo, setPreparo] = useState<PreparoDaMusica>({ tipo: sala.souHost ? "pronta" : "baixando" });
  const chave = JSON.stringify(sala.musica);

  useEffect(() => {
    if (sala.souHost) return;
    let valendo = true;
    setPreparo({ tipo: "baixando" });
    resolverMusica(sala.musica, musicas, endereco)
      .then(() => valendo && setPreparo({ tipo: "pronta" }))
      .catch((erro) => valendo && setPreparo({ tipo: "erro", mensagem: erro instanceof Error ? erro.message : String(erro) }));
    return () => {
      valendo = false;
    };
    // Só baixa de novo quando a música muda; a lista local e o endereço não mudam no meio da sala.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, sala.souHost]);

  return preparo;
}
