import { Trophy, UserRound } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface Props {
  posicao: number;
  nome: string;
  /** Sem a propriedade, a linha não tem espaço de foto (músicas). */
  avatar?: string | null;
  /** A linha de quem está logado ganha destaque. */
  minha: boolean;
  /** Texto menor ao lado do nome. */
  detalhe: React.ReactNode;
  /** O número que decide a posição (pontos, XP). */
  valor: React.ReactNode;
}

/** Uma linha de ranking: posição, foto, nome e o número que ordena. */
export function LinhaComPosicao({ posicao, nome, avatar, minha, detalhe, valor }: Props) {
  return (
    // Compacta: a 720p cabem várias linhas no espaço que sobra ao lado da roda.
    <li className={cn("chapa flex items-center gap-2 px-2 py-1 pr-4", minha ? "border-primaria bg-superficie-elevada" : "border-borda bg-superficie")}>
      <span className={cn("w-12 shrink-0 text-center font-titulo text-xl", posicao <= 3 ? "text-ouro" : "text-texto-suave")}>#{posicao}</span>
      {avatar ? (
        <img src={avatar} alt="" referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-sm" />
      ) : (
        avatar === null && <UserRound className="size-8 shrink-0 text-texto-suave opacity-70" aria-hidden />
      )}
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate text-base font-bold">{nome}</span>
        <span className="shrink-0 text-base text-texto-suave">{detalhe}</span>
      </span>
      {posicao === 1 && <Trophy className="size-4 shrink-0 text-ouro opacity-70" aria-label="Primeiro lugar" />}
      <span className="shrink-0 font-mono text-xl font-black tabular-nums">{valor}</span>
    </li>
  );
}
