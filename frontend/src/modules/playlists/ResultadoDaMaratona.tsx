import { Flag } from "lucide-react";
import { porcentagem } from "@/shared/lib/formatar";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { NumeroDestacado } from "@/shared/ui/NumeroDestacado";
import { placarDaMaratona, type Maratona } from "./maratona";

const formatar = (n: number) => n.toLocaleString("pt-BR");

/** O fim da maratona: o total e como foi cada música. */
export function ResultadoDaMaratona({ maratona, aoContinuar }: { maratona: Maratona; aoContinuar: () => void }) {
  const placar = placarDaMaratona(maratona);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6 max-md:gap-2 max-md:p-3">
      <header className="flex items-center gap-3">
        <Flag className="size-6 text-destaque" aria-hidden />
        <h2 className="truncate font-titulo text-3xl tracking-wide uppercase max-md:text-2xl">Maratona: {maratona.nome}</h2>
      </header>
      <section className="grid grid-cols-3 gap-4 max-md:gap-2">
        <NumeroDestacado rotulo="Pontos" valor={formatar(placar.pontos)} />
        <NumeroDestacado rotulo="Precisão média" valor={porcentagem(placar.precisao)} />
        <NumeroDestacado rotulo="Concluídas" valor={`${placar.concluidas}/${placar.total}`} />
      </section>
      <ol aria-label="Músicas da maratona" className="placa flex flex-col divide-y divide-borda">
        {maratona.faixas.map((faixa, i) => {
          const r = maratona.resultados[i];
          return (
            <li key={`${faixa.musica}:${faixa.versao}`} className={cn("flex items-center gap-3 px-4 py-2", !r && "opacity-50")}>
              <span className="w-6 text-texto-suave tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{faixa.titulo}</span>
              {r ? (
                <>
                  <span className={cn("text-sm", r.derrota ? "text-perigo" : "text-texto-suave")}>{r.derrota ? "Vaiada" : porcentagem(r.precisao)}</span>
                  <span className="w-24 text-right font-mono tabular-nums">{formatar(r.pontos)}</span>
                </>
              ) : (
                <span className="text-sm text-texto-suave">Pulada</span>
              )}
            </li>
          );
        })}
      </ol>
      <Button className="self-end" onClick={aoContinuar}>
        Voltar para a seleção
      </Button>
    </div>
  );
}
