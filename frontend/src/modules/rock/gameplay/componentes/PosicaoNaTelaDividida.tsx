import { useCallback, useRef, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import type { LojaDoHud } from "../lojaDoHud";
import { posicoesPorPontos } from "../posicoes";

/** Os pontos de todas as colunas, como texto estável: só re-renderiza quando algum muda. */
function usePontosDeTodos(lojas: LojaDoHud<{ pontos: number }>[]) {
  const inscrever = useCallback((ouvinte: () => void) => {
    const saidas = lojas.map((l) => l.inscrever(ouvinte));
    return () => saidas.forEach((sair) => sair());
  }, [lojas]);
  const ler = () => lojas.map((l) => l.ler().pontos).join(",");
  return useSyncExternalStore(inscrever, ler).split(",").map(Number);
}

/** O nome do jogador da coluna com a posição ao vivo dele, que pula quando ele passa alguém. */
export function PosicaoNaTelaDividida({ lojas, indice, nome }: { lojas: LojaDoHud<{ pontos: number }>[]; indice: number; nome: string }) {
  const posicao = posicoesPorPontos(usePontosDeTodos(lojas))[indice];
  const anterior = useRef(posicao);
  const subiu = posicao < anterior.current;
  anterior.current = posicao;
  return (
    <span aria-label={`${nome} em ${posicao}º`} className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-2 rounded-sm bg-superficie-elevada px-2 font-titulo text-lg tracking-wide">
      <motion.span
        key={posicao}
        initial={subiu ? { scale: 1.6 } : false}
        animate={{ scale: 1 }}
        className={cn("font-black", posicao === 1 ? "text-ouro" : "text-texto-suave")}
      >
        {posicao}º
      </motion.span>
      {nome}
    </span>
  );
}
