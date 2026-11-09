import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";

interface PropsDaBarra {
  /** Só para leitores de tela. */
  titulo?: string;
  aoVoltar?: () => void;
  /** Ao lado do voltar (ex.: os mods do Mania). */
  esquerda?: React.ReactNode;
  /** As ações à direita (BotaoDaSelecao). */
  children?: React.ReactNode;
}

/** O topo da coluna de informações da seleção, igual nos dois modos: voltar à esquerda e as ações à direita. */
export function BarraDaSelecao({ titulo, aoVoltar, esquerda, children }: PropsDaBarra) {
  return (
    <header className="flex items-start justify-between gap-4 max-md:gap-2">
      <div className="flex shrink-0 items-center gap-2">
        {aoVoltar && (
          <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
            <ArrowLeft aria-hidden />
          </Button>
        )}
        {titulo && <h1 className="sr-only">{titulo}</h1>}
        {esquerda}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
    </header>
  );
}

interface PropsDoTitulo {
  titulo: string;
  subtitulo: string;
  /** Uma linha menor abaixo (ex.: "Importado · sem XP nem ranking"). */
  aviso?: React.ReactNode;
  capa?: React.ReactNode;
  /** À direita do título (ex.: favoritar). */
  acao?: React.ReactNode;
}

/** O cartão com o nome do que está selecionado. */
export function TituloDaSelecao({ titulo, subtitulo, aviso, capa, acao }: PropsDoTitulo) {
  return (
    <div className="chapa flex items-center gap-4 bg-superficie-elevada/95 px-4 py-3">
      {capa}
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-titulo text-3xl tracking-wide uppercase max-md:text-2xl">{titulo}</h2>
        <p className="truncate text-texto-suave">{subtitulo}</p>
        {aviso && <p className="text-sm text-texto-suave">{aviso}</p>}
      </div>
      {acao}
    </div>
  );
}
