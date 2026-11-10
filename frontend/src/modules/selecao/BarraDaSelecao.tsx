import { BotaoVoltar } from "@/shared/ui/BotaoVoltar";

interface PropsDaBarra {
  /** Só para leitores de tela. */
  titulo?: string;
  aoVoltar?: () => void;
  /** Na linha de baixo (ex.: os mods). */
  abaixo?: React.ReactNode;
  /** As ações à direita do voltar (BotaoDaSelecao), sempre numa linha só. */
  children?: React.ReactNode;
}

/** O topo da coluna de informações da seleção, igual nos dois modos: voltar e as ações numa linha, e os mods embaixo. */
export function BarraDaSelecao({ titulo, aoVoltar, abaixo, children }: PropsDaBarra) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        {aoVoltar && <BotaoVoltar aoVoltar={aoVoltar} />}
        {titulo && <h1 className="sr-only">{titulo}</h1>}
        <div className="flex min-w-0 items-center justify-end gap-2">{children}</div>
      </div>
      {abaixo}
    </header>
  );
}

interface PropsDoTitulo {
  titulo: string;
  subtitulo: string;
  /** Uma linha menor abaixo (ex.: "Importado · sem XP nem ranking"). */
  aviso?: React.ReactNode;
  capa?: React.ReactNode;
  /** Uma imagem larga acima do título, na largura do cartão (ex.: o fundo do mapa no Mania). */
  faixa?: React.ReactNode;
  /** À direita do título (ex.: favoritar). */
  acao?: React.ReactNode;
}

/** O cartão com o nome do que está selecionado. */
export function TituloDaSelecao({ titulo, subtitulo, aviso, capa, faixa, acao }: PropsDoTitulo) {
  const linha = (
    <div className="flex items-center gap-4 px-4 py-3">
      {capa}
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-titulo text-3xl tracking-wide uppercase max-md:text-2xl">{titulo}</h2>
        <p className="truncate text-texto-suave">{subtitulo}</p>
        {aviso && <p className="text-sm text-texto-suave">{aviso}</p>}
      </div>
      {acao}
    </div>
  );
  return (
    <div className="chapa overflow-hidden bg-superficie-elevada/95">
      {faixa && <div className="h-36 w-full [mask-composite:intersect] [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent),linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] max-md:hidden">{faixa}</div>}
      {linha}
    </div>
  );
}
