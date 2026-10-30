import { ListMusic, RotateCcw, Trophy } from "lucide-react";
import { corDaPrecisao } from "@/modules/rock/gameplay";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { classificar, type ResultadoDoJogador } from "./classificacao";

interface Props {
  titulo: string;
  artista: string;
  resultados: ResultadoDoJogador[];
  aoRepetir: () => void;
  aoContinuar: () => void;
}

const formatar = (n: number) => n.toLocaleString("pt-BR");
const precisaoDe = ({ precisao, acertos, total }: ResultadoDoJogador["resultado"]) => precisao ?? (total ? acertos / total : 0);

/** O placar da tela dividida: sem ranking nem XP, só quem tocou melhor nesta música. */
export function ResultadoDaTelaDividida({ titulo, artista, resultados, aoRepetir, aoContinuar }: Props) {
  return (
    <div className="respiro-de-tela flex h-full flex-col items-center justify-center gap-6">
      <div className="text-center">
        <h1 className="titulo-de-tela">Resultado</h1>
        <p className="text-base text-texto-suave">
          {titulo} · {artista}
        </p>
      </div>

      <ol className="flex w-full max-w-xl flex-col gap-2">
        {classificar(resultados).map(({ nome, resultado, posicao }) => (
          <li key={nome} className={cn("chapa flex items-center gap-4 px-4 py-3", posicao === 1 && "border-ouro")}>
            <span className="w-8 font-titulo text-2xl tabular-nums">{posicao}º</span>
            {posicao === 1 && <Trophy className="size-5 text-ouro opacity-70" aria-hidden />}
            <span className="flex-1 font-titulo text-2xl tracking-wide">{nome}</span>
            <span className={cn("font-mono text-base tabular-nums", corDaPrecisao(precisaoDe(resultado)))}>{Math.round(precisaoDe(resultado) * 100)}%</span>
            <span className="w-28 text-right font-mono text-xl font-bold tabular-nums">{formatar(resultado.pontos)}</span>
          </li>
        ))}
      </ol>

      <div className="flex gap-4">
        <Button size="lg" variant="outline" onClick={aoContinuar}>
          <ListMusic className="opacity-70" /> Outra música
        </Button>
        <Button size="lg" onClick={aoRepetir}>
          <RotateCcw className="opacity-70" /> Tocar de novo
        </Button>
      </div>
    </div>
  );
}
