import { useEffect, useRef } from "react";

/**
 * A sala só fica aberta nas telas que o modo declara (lobby, busca aberta pela sala, partida em rede).
 * Qualquer outro caminho, até um que ainda nem existe, fecha a conexão, para ninguém ficar na sala sem ver.
 */
export function useSalaSoNasTelasDela(naSala: boolean, telaMantemASala: boolean, sair: () => void) {
  const ultimo = useRef({ naSala, sair });
  ultimo.current = { naSala, sair };

  useEffect(() => {
    if (naSala && !telaMantemASala) sair();
  }, [naSala, telaMantemASala]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trocar de modo desmonta a tela dele inteira: a sala daquele modo fecha junto.
  useEffect(
    () => () => {
      if (ultimo.current.naSala) ultimo.current.sair();
    },
    [],
  );
}
