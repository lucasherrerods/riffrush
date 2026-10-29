import { useRef } from "react";
import { motion } from "framer-motion";
import { useConta } from "@/modules/conta";
import type { Dificuldade, Instrumento } from "@/modules/rock/songs";
import { cn } from "@/shared/lib/utils";
import { montarPlacar, pontuacoesAcima } from "./placar";
import { useRanking, type OpcoesDoRanking } from "./useRanking";

interface Props extends OpcoesDoRanking {
  musicaId: string;
  dificuldade: Dificuldade;
  /** Sem ele, o ranking da guitarra. */
  instrumento?: Instrumento;
  /** Os pontos da partida agora. */
  pontos: number;
}

const formatar = (n: number) => n.toLocaleString("pt-BR");
const MOLA = { type: "spring", stiffness: 400, damping: 32 } as const;

/** O placar no canto da partida, como no osu!: o ranking da música com você subindo nele ao vivo. */
export function PlacarAoVivo({ musicaId, dificuldade, instrumento = "guitarra", pontos, atrasoMs = 0, ...opcoes }: Props) {
  const estado = useRanking(musicaId, dificuldade, instrumento, { atrasoMs, ...opcoes });
  const nome = useConta().conta?.nome ?? "Você";
  // Cada vez que menos gente fica acima de você, conta uma ultrapassagem: ela dispara o brilho da sua linha.
  const acimaAntes = useRef<number | null>(null);
  const ultrapassagens = useRef(0);

  if (estado.tipo !== "pronto") return null;
  const linhas = montarPlacar(estado.ranking, pontos, nome);
  const acima = pontuacoesAcima(estado.ranking, pontos).length;
  if (acimaAntes.current !== null && acima < acimaAntes.current) ultrapassagens.current += 1;
  acimaAntes.current = acima;

  return (
    <ol aria-label="Placar da música" className="flex w-64 flex-col gap-1">
      {linhas.map((linha) => (
        <motion.li
          key={linha.id}
          layout
          transition={MOLA}
          data-ultrapassagens={linha.voce ? ultrapassagens.current : undefined}
          className={cn(
            "chapa relative flex items-center gap-2 overflow-hidden px-2 py-1",
            linha.voce ? "border-primaria bg-superficie-elevada" : "border-borda bg-superficie",
          )}
        >
          {linha.voce && ultrapassagens.current > 0 && (
            // Uma chave nova a cada ultrapassagem refaz o brilho do começo.
            <motion.span
              key={ultrapassagens.current}
              aria-hidden
              initial={{ opacity: 0.7 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="pointer-events-none absolute inset-0 bg-primaria"
            />
          )}
          <motion.span
            key={linha.voce ? `pos-${ultrapassagens.current}` : "pos"}
            initial={linha.voce && ultrapassagens.current > 0 ? { scale: 1.4 } : false}
            animate={{ scale: 1 }}
            className={cn("relative w-10 shrink-0 font-titulo text-lg", linha.posicao === 1 ? "text-ouro" : "text-texto-suave")}
          >
            #{linha.posicao ?? "?"}
          </motion.span>
          <span className="relative min-w-0 flex-1 truncate text-base font-bold">
            {linha.voce ? "Você" : linha.nome}
            {linha.recorde && <span className="ml-1 font-normal text-texto-suave">(recorde)</span>}
          </span>
          <span className="relative shrink-0 font-mono text-base tabular-nums">{formatar(linha.pontos)}</span>
        </motion.li>
      ))}
    </ol>
  );
}
