import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { ConfirmacaoDeTamanho } from "./componentes/ConfirmacaoDeTamanho";
import { AcaoDoResultado, ItemDoResultado } from "./componentes/ResultadoDoEncore";
import { buscarChartPeloMd5, type ResultadoDaBusca } from "./encore";
import { useBaixarDoEncore, type AoBaixar } from "./useBaixarDoEncore";

interface Props {
  md5: string;
  aoFechar: () => void;
  aoBaixar: AoBaixar;
  /** md5 dos charts que já estão na biblioteca. */
  baixadas: ReadonlySet<string>;
  aoJogar: (md5: string) => void;
  buscarChart?: (md5: string, opcoes: { sinal: AbortSignal }) => Promise<ResultadoDaBusca | null>;
}

type Estado = { tipo: "carregando" } | { tipo: "pronto"; chart: ResultadoDaBusca } | { tipo: "erro"; mensagem: string };

/** Baixa um chart do Encore sem sair da tela de onde ele foi aberto (o leaderboard, por exemplo). */
export function JanelaDoChart({ md5, aoFechar, aoBaixar, baixadas, aoJogar, buscarChart = buscarChartPeloMd5 }: Props) {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const { baixando, pergunta, baixar, responder } = useBaixarDoEncore(aoBaixar, false);

  useEffect(() => {
    const controle = new AbortController();
    setEstado({ tipo: "carregando" });
    buscarChart(md5, { sinal: controle.signal })
      .then((chart) => setEstado(chart ? { tipo: "pronto", chart } : { tipo: "erro", mensagem: "Esse chart não está mais no Encore." }))
      .catch((erro: Error) => !controle.signal.aborted && setEstado({ tipo: "erro", mensagem: erro.message }));
    return () => controle.abort();
  }, [md5, buscarChart]);

  return (
    <>
      {/* Baixando, a janela não fecha: o download seguiria sem ninguém ver o fim. */}
      <Dialog open onOpenChange={(aberta) => !aberta && !baixando && aoFechar()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogTitle>Baixar do Encore</DialogTitle>
          <DialogDescription>O chart entra na sua biblioteca e você continua aqui.</DialogDescription>
          {estado.tipo === "carregando" && (
            <p className="flex items-center gap-2 py-4 text-base text-texto-suave">
              <LoaderCircle className="size-4 animate-spin opacity-70" aria-hidden />
              Procurando o chart...
            </p>
          )}
          {estado.tipo === "erro" && (
            <p role="alert" className="py-4 text-base text-texto-suave">
              {estado.mensagem}
            </p>
          )}
          {estado.tipo === "pronto" && (
            <ul>
              <ItemDoResultado resultado={estado.chart}>
                <AcaoDoResultado
                  resultado={estado.chart}
                  baixada={baixadas.has(estado.chart.md5)}
                  baixando={baixando?.fracao}
                  ocupado={!!baixando}
                  aoBaixar={() => void baixar(estado.chart)}
                  aoJogar={() => aoJogar(estado.chart.md5)}
                />
              </ItemDoResultado>
            </ul>
          )}
        </DialogContent>
      </Dialog>
      {pergunta && <ConfirmacaoDeTamanho titulo={pergunta.titulo} bytes={pergunta.bytes} aoResponder={responder} />}
    </>
  );
}
