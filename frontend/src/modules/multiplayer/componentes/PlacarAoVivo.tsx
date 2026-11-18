import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronUp } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface LinhaAoVivo {
  id: number;
  nome: string;
  pontos: number;
  meu: boolean;
  derrota: boolean;
  /** O que o modo mostra a mais na linha (o avatar e a vida no Rock, a precisão no Mania). */
  extra?: ReactNode;
}

interface Props {
  linhas: LinhaAoVivo[];
  /** No celular: linhas curtas, no canto, para não cobrir a pista. */
  compacto?: boolean;
  rotuloDaDerrota?: string;
}

/** Quanto tempo a seta de quem subiu fica na tela. */
const DESTAQUE_MS = 1500;

const formatar = (pontos: number, compacto: boolean) => (compacto ? `${Math.floor(pontos / 1000)}k` : pontos.toLocaleString("pt-BR"));

/** A posição de cada jogador durante a partida, que se reordena quando alguém ultrapassa. */
export function PlacarAoVivo({ linhas, compacto = false, rotuloDaDerrota = "Falhou" }: Props) {
  const ordenadas = [...linhas].sort((a, b) => b.pontos - a.pontos || a.id - b.id);
  const ordem = ordenadas.map((l) => l.id).join(",");
  // Quem acabou de passar alguém ganha a seta por um instante.
  const anteriores = useRef<number[]>([]);
  const [subiram, setSubiram] = useState<Set<number>>(new Set());
  useEffect(() => {
    const atual = ordem.split(",").map(Number);
    const antes = anteriores.current;
    anteriores.current = atual;
    const novos = new Set(atual.filter((id, i) => antes.includes(id) && antes.indexOf(id) > i));
    if (!novos.size) return;
    setSubiram(novos);
    const id = setTimeout(() => setSubiram(new Set()), DESTAQUE_MS);
    return () => clearTimeout(id);
  }, [ordem]);

  if (linhas.length < 2) return null;
  return (
    <ol
      aria-label="Placar ao vivo"
      className={cn("pointer-events-none absolute flex flex-col gap-2", compacto ? "top-36 left-4 w-32 gap-1" : "top-28 left-6 w-60")}
    >
      {ordenadas.map((linha, i) => {
        const subiu = subiram.has(linha.id);
        return (
          <motion.li
            key={linha.id}
            layout
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
            aria-label={`${i + 1}º ${linha.nome}`}
            data-subiu={subiu || undefined}
            className={cn(
              "chapa flex items-center gap-2",
              compacto ? "px-2 py-1" : "p-2",
              linha.meu ? "border-primaria bg-superficie-elevada" : "border-borda bg-superficie",
              linha.derrota && "opacity-60",
            )}
          >
            <span className={cn("w-7 shrink-0 text-center font-black", i === 0 ? "text-ouro" : "text-texto-suave", compacto ? "text-base" : "text-xl")}>{i + 1}º</span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-base font-bold leading-tight">
                <span className="truncate">{linha.nome}</span>
                {subiu && <ChevronUp className="size-4 shrink-0 text-sucesso" aria-label="Subiu" />}
              </p>
              <p className="flex items-baseline justify-between gap-2">
                <span className="font-mono font-black tabular-nums">{formatar(linha.pontos, compacto)}</span>
                {linha.derrota && <span className="text-sm font-bold text-perigo">{rotuloDaDerrota}</span>}
              </p>
              {linha.extra}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
