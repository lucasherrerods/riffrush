import { useEffect, useState } from "react";

/** Abaixo dessa largura a interface usa o layout de celular. */
export const LARGURA_DO_CELULAR = 768;

export const ehTelaEstreita = (largura = window.innerWidth) => largura < LARGURA_DO_CELULAR;

export function useTelaEstreita() {
  const [estreita, setEstreita] = useState(() => ehTelaEstreita());
  useEffect(() => {
    const aoRedimensionar = () => setEstreita(ehTelaEstreita());
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);
  return estreita;
}
