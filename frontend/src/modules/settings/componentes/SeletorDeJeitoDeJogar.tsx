import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { IconeDoJeito, type JeitoDeJogar } from "@/modules/rock/gameplay";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { JEITOS, type TeclasDoExemplo } from "../jeitosDeJogar";

interface Props {
  valor: JeitoDeJogar;
  aoEscolher: (jeito: JeitoDeJogar) => void;
  teclas: TeclasDoExemplo;
}

/** Os três jeitos de jogar lado a lado: o escolhido fica aceso e os outros apagados. Cada um tem a sua ajuda. */
export function SeletorDeJeitoDeJogar({ valor, aoEscolher, teclas }: Props) {
  const [ajuda, setAjuda] = useState<JeitoDeJogar | null>(null);
  const aberto = JEITOS.find((j) => j.id === ajuda);

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-superficie-elevada p-4 max-md:p-3">
      <p className="text-base font-semibold max-md:text-sm">Jeito de jogar</p>
      <div role="radiogroup" aria-label="Jeito de jogar" className="grid grid-cols-3 gap-2">
        {JEITOS.map((jeito) => {
          const escolhido = jeito.id === valor;
          return (
            <div
              key={jeito.id}
              className={cn(
                "relative rounded-lg border-2 transition-colors",
                escolhido ? "border-primaria bg-superficie text-texto" : "border-borda bg-superficie text-texto-suave opacity-60 hover:opacity-100",
              )}
            >
              <button
                role="radio"
                aria-checked={escolhido}
                aria-label={`${jeito.nome}: ${jeito.resumo}`}
                onClick={() => aoEscolher(jeito.id)}
                className="flex h-full w-full flex-col items-start gap-1 p-4 pr-10 text-left max-md:p-2 max-md:pr-8"
              >
                <IconeDoJeito jeito={jeito.id} className={cn("size-6 max-md:size-5", escolhido ? "text-primaria" : "opacity-70")} />
                <span className="font-titulo text-2xl tracking-wide uppercase max-md:text-lg">{jeito.nome}</span>
                <span className="text-sm max-md:text-xs">{jeito.resumo}</span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Como funciona o ${jeito.nome}`}
                onClick={() => setAjuda(jeito.id)}
                className="absolute top-2 right-2 size-8 max-md:top-1 max-md:right-1"
              >
                <CircleHelp className="opacity-70" />
              </Button>
            </div>
          );
        })}
      </div>

      <Dialog open={aberto !== undefined} onOpenChange={(abrir) => !abrir && setAjuda(null)}>
        {aberto && (
          <DialogContent className="flex max-w-lg flex-col gap-4">
            <DialogTitle className="flex items-center gap-2">
              <IconeDoJeito jeito={aberto.id} className="size-6 text-primaria" />
              {aberto.nome}
            </DialogTitle>
            <DialogDescription>{aberto.resumo}.</DialogDescription>
            {aberto.explicacao(teclas).map((paragrafo) => (
              <p key={paragrafo} className="text-base leading-relaxed">
                {paragrafo}
              </p>
            ))}
            <div className="flex justify-end gap-2">
              {aberto.id !== valor && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    aoEscolher(aberto.id);
                    setAjuda(null);
                  }}
                >
                  Jogar assim
                </Button>
              )}
              <DialogClose asChild>
                <Button>Entendi</Button>
              </DialogClose>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
