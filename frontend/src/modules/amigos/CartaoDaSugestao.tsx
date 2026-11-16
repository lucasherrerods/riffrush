import { Music, Play } from "lucide-react";
import type { SugestaoDeMusica } from "@/modules/presenca";
import { Button } from "@/shared/ui/button";
import { EtiquetaDeModo } from "@/shared/ui/EtiquetaDeModo";

/** A música que um amigo sugeriu, dentro da conversa. Fica dentro do parágrafo da mensagem, por isso só spans. */
export function CartaoDaSugestao({ sugestao, aoTocar }: { sugestao: SugestaoDeMusica; aoTocar?: (sugestao: SugestaoDeMusica) => void }) {
  const detalhe = [sugestao.artista, sugestao.dificuldade].filter(Boolean).join(" · ");
  return (
    <span role="group" aria-label={`Música sugerida: ${sugestao.titulo}`} className="flex items-center gap-3 rounded-md border border-borda bg-superficie p-2">
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-superficie-elevada text-texto-suave">
        <Music className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <EtiquetaDeModo modo={sugestao.modo} />
          <span className="truncate font-bold">{sugestao.titulo}</span>
        </span>
        {detalhe && <span className="block truncate text-xs text-texto-suave">{detalhe}</span>}
      </span>
      {aoTocar && (
        <Button size="sm" className="shrink-0" onClick={() => aoTocar(sugestao)}>
          <Play /> Tocar
        </Button>
      )}
    </span>
  );
}
