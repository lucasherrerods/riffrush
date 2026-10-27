import { rotuloDaVelocidade, velocidadesDaMusica } from "@/modules/gameplay";
import { cn } from "@/shared/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { multiplicadorDePontos, proximaVelocidade } from "../modificadores";
import { IconeDeModificador } from "./IconeDeModificador";

interface Props {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  velocidadeDaMusica: number;
  aoMudarVelocidade: (velocidade: number) => void;
}

/** Os modificadores da partida, escolhidos antes de tocar. Clique avança o nível; o botão direito volta. */
export function ModalDeModificadores({ aberto, aoMudarAberto, velocidadeDaMusica, aoMudarVelocidade }: Props) {
  const multiplicador = multiplicadorDePontos({ velocidadeDaMusica });
  const velocidadeAtiva = velocidadeDaMusica !== 1;
  const mudarVelocidade = (passo: number) => aoMudarVelocidade(proximaVelocidade(velocidadesDaMusica(), velocidadeDaMusica, passo));

  return (
    <Dialog open={aberto} onOpenChange={aoMudarAberto}>
      <DialogContent className="max-w-xl">
        <DialogTitle>Modificadores</DialogTitle>
        <p className={cn("font-titulo text-2xl tracking-wide", multiplicador > 1 ? "text-sucesso" : multiplicador < 1 ? "text-destaque" : "text-texto")}>
          Multiplicador de pontos: {rotuloDaVelocidade(multiplicador)}
        </p>
        <DialogDescription>Clique para mudar o nível. O botão direito volta um nível.</DialogDescription>
        <div className="flex flex-wrap gap-4">
          <button
            aria-pressed={velocidadeAtiva}
            onClick={() => mudarVelocidade(1)}
            onContextMenu={(evento) => {
              evento.preventDefault();
              mudarVelocidade(-1);
            }}
            className="flex items-center gap-4 rounded-md p-2 text-left transition-colors hover:bg-superficie-elevada"
          >
            <IconeDeModificador sigla="VL" ativo={velocidadeAtiva} />
            <span>
              <span className="block font-titulo text-xl tracking-wide uppercase">Velocidade</span>
              <span className={cn("block font-mono text-lg", velocidadeAtiva ? "text-destaque" : "text-texto-suave")}>{rotuloDaVelocidade(velocidadeDaMusica)}</span>
            </span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
