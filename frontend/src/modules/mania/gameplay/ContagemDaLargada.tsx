import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useBipDaContagem } from "@/modules/audio";
import { NumeroDaContagem } from "@/shared/ui/NumeroDaContagem";

const PASSO_MS = 50;

/** O 3, 2, 1 até o `inicio` da sala (performance.now); fora dos três últimos segundos, zero. */
export function numeroDaLargada(inicio: number, agora: number) {
  const falta = Math.ceil((inicio - agora) / 1000);
  return falta >= 1 && falta <= 3 ? falta : 0;
}

/** A contagem da largada da sala por cima da pista, com o bip de cada número. */
export function ContagemDaLargada({ inicio, volume }: { inicio: number; volume: number }) {
  const [numero, setNumero] = useState(() => numeroDaLargada(inicio, performance.now()));
  useEffect(() => {
    const id = setInterval(() => {
      setNumero(numeroDaLargada(inicio, performance.now()));
      if (performance.now() > inicio) clearInterval(id);
    }, PASSO_MS);
    return () => clearInterval(id);
  }, [inicio]);
  useBipDaContagem(numero, volume, true);
  return <AnimatePresence>{numero > 0 && <NumeroDaContagem key={numero} valor={numero} rotulo={`Começa em ${numero}`} />}</AnimatePresence>;
}
