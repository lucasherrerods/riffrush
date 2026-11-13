import { Clapperboard } from "lucide-react";
import { AcaoDaBusca, ItemDaBusca, type EstadoDaPrevia } from "@/modules/busca";
import { formatarDuracao } from "@/shared/lib/formatar";
import { type ResultadoDaBusca } from "../encore";

interface Props {
  resultado: ResultadoDaBusca;
  baixada: boolean;
  /** Fração já baixada, quando este é o download em andamento. */
  baixando?: number;
  /** Outro download em andamento. */
  ocupado: boolean;
  /** Sem ela, o item só mostra o chart. */
  aoBaixar?: () => void;
  aoJogar?: () => void;
  previa?: { estado: EstadoDaPrevia; aoAlternar: () => void };
}

/** Um chart do Encore no item de busca comum aos dois modos. */
export function ResultadoDoEncore({ resultado, baixada, baixando, ocupado, aoBaixar, aoJogar, previa }: Props) {
  const detalhes = [resultado.album, resultado.ano, resultado.genero].filter(Boolean).join(" · ");
  return (
    <ItemDaBusca
      titulo={resultado.titulo}
      capa={resultado.capa}
      linhas={[`${resultado.artista}${detalhes ? ` · ${detalhes}` : ""}`, ...(resultado.charter ? [`Chart por ${resultado.charter}`] : [])]}
      selos={
        resultado.temVideo && (
          <span className="flex shrink-0 items-center gap-1 rounded-sm border border-borda px-1.5 text-sm text-texto-suave">
            <Clapperboard className="size-3.5 opacity-70" aria-hidden />
            Vídeo
          </span>
        )
      }
      lateral={<span className="font-titulo text-xl text-texto-suave max-md:text-base">{formatarDuracao(resultado.duracaoMs)}</span>}
      progresso={baixando}
      previa={previa}
      acao={
        aoBaixar && (
          <AcaoDaBusca
            nome={resultado.titulo}
            estado={baixada ? { tipo: "baixado", aoJogar } : baixando !== undefined ? { tipo: "baixando" } : { tipo: "baixavel", aoBaixar, ocupado }}
          />
        )
      }
    />
  );
}
