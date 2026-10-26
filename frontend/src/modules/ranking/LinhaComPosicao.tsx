import { Trophy, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface Props {
  posicao: number;
  nome: string;
  /** A foto (ou capa). `null` mostra o ícone no lugar; sem a propriedade, a linha não tem espaço de foto. */
  avatar?: string | null;
  /** O ícone quando não há foto. */
  semFoto?: LucideIcon;
  /** A linha de quem está logado ganha destaque. */
  minha: boolean;
  /** Texto menor ao lado do nome. */
  detalhe: React.ReactNode;
  /** O número que decide a posição (pontos, XP). */
  valor: React.ReactNode;
  /** Nome do botão para leitores de tela, quando a linha é clicável. */
  rotuloDoClique?: string;
  /** Com ele, a linha vira um botão. */
  aoClicar?: () => void;
  /** Vem logo depois da posição (ex.: a nota da partida). */
  selo?: React.ReactNode;
  /** Um botão a mais no fim da linha (ex.: ouvir a prévia). */
  acao?: React.ReactNode;
}

/** Uma linha de ranking: posição, foto, nome e o número que ordena. */
export function LinhaComPosicao({ posicao, nome, avatar, semFoto: SemFoto = UserRound, minha, detalhe, valor, aoClicar, rotuloDoClique = `Ver a partida de ${nome}`, selo, acao }: Props) {
  const conteudo = (
    <>
      <span className={cn("w-12 shrink-0 text-center font-titulo text-xl", posicao <= 3 ? "text-ouro" : "text-texto-suave")}>#{posicao}</span>
      {selo}
      {avatar ? (
        <img src={avatar} alt="" referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-sm" />
      ) : (
        avatar === null && <SemFoto className="size-8 shrink-0 text-texto-suave opacity-70" aria-hidden />
      )}
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate text-base font-bold">{nome}</span>
        <span className="shrink-0 text-base text-texto-suave">{detalhe}</span>
      </span>
      {posicao === 1 && <Trophy className="size-4 shrink-0 text-ouro opacity-70" aria-label="Primeiro lugar" />}
      <span className="shrink-0 font-mono text-xl font-black tabular-nums">{valor}</span>
    </>
  );
  // Compacta: a 720p cabem várias linhas no espaço que sobra ao lado da roda.
  const classe = cn("chapa flex items-center gap-2 px-2 py-1 pr-4", minha ? "border-primaria bg-superficie-elevada" : "border-borda bg-superficie");
  if (!aoClicar) {
    return (
      <li className={classe}>
        {conteudo}
        {acao}
      </li>
    );
  }
  // A ação fica fora do botão da linha: botão dentro de botão não é permitido.
  return (
    <li className={cn(classe, "hover:bg-superficie-elevada")}>
      <button type="button" aria-label={rotuloDoClique} onClick={aoClicar} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        {conteudo}
      </button>
      {acao}
    </li>
  );
}
