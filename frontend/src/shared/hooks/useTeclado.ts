import { useEffect, useRef } from "react";
import { useIsPresent } from "framer-motion";

/**
 * Escuta as teclas na janela inteira, sempre com a versão mais recente da função.
 * Enquanto a tela faz a animação de saída, as teclas são ignoradas para não
 * caírem na tela errada.
 */
export function useTeclado(aoApertar: (evento: KeyboardEvent) => void, opcoes: { captura?: boolean } = {}) {
  const presente = useIsPresent();
  const atual = useRef(aoApertar);
  atual.current = aoApertar;
  const ativo = useRef(presente);
  ativo.current = presente;

  useEffect(() => {
    const ouvir = (evento: KeyboardEvent) => {
      if (ativo.current) atual.current(evento);
    };
    window.addEventListener("keydown", ouvir, opcoes.captura);
    return () => window.removeEventListener("keydown", ouvir, opcoes.captura);
  }, [opcoes.captura]);
}
