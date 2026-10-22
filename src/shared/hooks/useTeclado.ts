import { useEffect, useRef } from "react";

/** Escuta as teclas na janela inteira, sempre com a versão mais recente da função. */
export function useTeclado(aoApertar: (evento: KeyboardEvent) => void, opcoes: { captura?: boolean } = {}) {
  const atual = useRef(aoApertar);
  atual.current = aoApertar;
  useEffect(() => {
    const ouvir = (evento: KeyboardEvent) => atual.current(evento);
    window.addEventListener("keydown", ouvir, opcoes.captura);
    return () => window.removeEventListener("keydown", ouvir, opcoes.captura);
  }, [opcoes.captura]);
}
