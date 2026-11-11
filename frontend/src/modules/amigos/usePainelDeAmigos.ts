import { useCallback, useState } from "react";

/** Se o painel de amigos está aberto. Trocar de tela fecha o painel. */
export function usePainelDeAmigos(tela: string) {
  const [estado, setEstado] = useState({ aberto: false, tela });
  // Ajusta durante o render, sem um efeito: a tela nova já aparece com o painel fechado.
  if (estado.tela !== tela) setEstado({ aberto: false, tela });
  const alternar = useCallback(() => setEstado((atual) => ({ ...atual, aberto: !atual.aberto })), []);
  const abrir = useCallback(() => setEstado((atual) => ({ ...atual, aberto: true })), []);
  const fechar = useCallback(() => setEstado((atual) => ({ ...atual, aberto: false })), []);
  return { aberto: estado.aberto && estado.tela === tela, alternar, abrir, fechar };
}
