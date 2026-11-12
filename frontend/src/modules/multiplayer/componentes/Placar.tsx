import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Crown, Ghost, Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface LinhaDoPlacar {
  id: number;
  nome: string;
  /** O retrato de cada modo (o personagem no Rock, por exemplo). */
  avatar?: ReactNode;
  pontos: number;
  meu: boolean;
  derrota: boolean;
  fantasma: boolean;
  terminou: boolean;
  /** Um número a mais do modo, como a precisão no Mania. */
  detalhe?: string;
}

interface Props {
  linhas: LinhaDoPlacar[];
  rotuloDaDerrota?: string;
  /** Durante a partida: só a ordem, sem esperar os outros nem coroar ninguém. */
  aoVivo?: boolean;
}

/** O placar da sala no fim da partida, atualizado ao vivo enquanto os outros terminam. */
export function Placar({ linhas, rotuloDaDerrota = "Vaiado", aoVivo = false }: Props) {
  const ordenadas = [...linhas].sort((a, b) => b.pontos - a.pontos);
  const esperando = !aoVivo && ordenadas.some((l) => !l.terminou);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-2">
      <ol className="flex flex-col gap-2">
        {ordenadas.map((linha, i) => (
          <motion.li
            key={linha.id}
            layout
            className={cn("chapa flex items-center gap-4 p-2 pr-4", linha.meu ? "border-primaria bg-superficie-elevada" : "border-borda bg-superficie")}
          >
            <span className="w-8 text-center text-2xl font-black text-texto-suave">{i + 1}º</span>
            {linha.avatar}
            <span className="flex flex-1 items-center gap-2 truncate text-base font-bold">
              <span>{linha.nome}</span>
              {i === 0 && !aoVivo && !esperando && <Crown aria-label="Vencedor" className="size-4 text-ouro" />}
            </span>
            {linha.fantasma && <Ghost aria-label="Virou fantasma" className="size-4 text-texto-suave" />}
            {linha.derrota && <span className="text-base font-bold text-perigo">{rotuloDaDerrota}</span>}
            {!aoVivo && !linha.terminou && <Loader2 className="size-4 animate-spin text-texto-suave" aria-label="Ainda tocando" />}
            {linha.detalhe && <span className="font-mono text-base tabular-nums text-texto-suave">{linha.detalhe}</span>}
            <span className="font-mono text-xl font-black tabular-nums">{linha.pontos.toLocaleString("pt-BR")}</span>
          </motion.li>
        ))}
      </ol>
      {esperando && <p className="text-center text-base text-texto-suave">Esperando os outros terminarem...</p>}
    </div>
  );
}
