import { useEffect, useRef, useState } from "react";
import type { PreparoDaEscolha } from "@/modules/multiplayer";
import { resolverMapa, type DependenciasDoMapa, type MapaDaBiblioteca } from "./mapaNaRede";
import type { MapaNaRede } from "./protocolo";

/**
 * O convidado baixa o mapa assim que o host escolhe, e não na largada: assim ele só dá pronto
 * quando já pode jogar. O host acha o dele na biblioteca.
 */
export function useMapaDaSala(mapa: MapaNaRede | null, souHost: boolean, dependencias: DependenciasDoMapa): { preparo: PreparoDaEscolha; achado?: MapaDaBiblioteca } {
  const [estado, setEstado] = useState<{ preparo: PreparoDaEscolha; achado?: MapaDaBiblioteca }>({ preparo: { tipo: souHost ? "pronta" : "baixando" } });
  // As dependências mudam a cada render (a lista da biblioteca cresce com o próprio download): só o mapa dispara a busca.
  const atuais = useRef(dependencias);
  atuais.current = dependencias;
  const chave = mapa ? `${mapa.tipo}:${mapa.hash}` : "";

  useEffect(() => {
    if (!mapa) return setEstado({ preparo: { tipo: souHost ? "pronta" : "baixando" } });
    let valendo = true;
    setEstado({ preparo: { tipo: souHost ? "pronta" : "baixando" } });
    resolverMapa(mapa, atuais.current)
      .then((achado) => valendo && setEstado({ preparo: { tipo: "pronta" }, achado }))
      .catch((erro) => valendo && setEstado({ preparo: souHost ? { tipo: "pronta" } : { tipo: "erro", mensagem: erro instanceof Error ? erro.message : String(erro) } }));
    return () => {
      valendo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, souHost]);

  return estado;
}
