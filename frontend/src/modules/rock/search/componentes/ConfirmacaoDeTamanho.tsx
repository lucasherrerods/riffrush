import { HardDriveDownload } from "lucide-react";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import { formatarTamanho } from "../download";

interface Props {
  titulo: string;
  bytes: number;
  aoResponder: (baixar: boolean) => void;
}

/** Pergunta antes de baixar um chart grande. Segue o cartão da importação. */
export function ConfirmacaoDeTamanho({ titulo, bytes, aoResponder }: Props) {
  useTeclado((evento) => {
    if (evento.code === "Escape") aoResponder(false);
    else if (evento.code === "Enter") {
      evento.preventDefault();
      aoResponder(true);
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-fundo/80 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="titulo-da-confirmacao"
        className="chapa flex w-96 max-w-[calc(100vw-32px)] flex-col gap-4 bg-superficie-elevada p-4"
      >
        <div className="flex items-center gap-2">
          <HardDriveDownload className="size-4 text-destaque opacity-70" aria-hidden />
          <h2 id="titulo-da-confirmacao" className="font-titulo text-xl tracking-wide uppercase">
            Arquivo grande
          </h2>
        </div>
        <p className="text-base text-texto-suave">
          <span className="text-texto">{titulo}</span> tem <span className="font-mono text-texto">{formatarTamanho(bytes)}</span>. Pode demorar e ocupar bastante espaço no
          aparelho.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => aoResponder(false)}>
            Cancelar
          </Button>
          <Button onClick={() => aoResponder(true)} autoFocus>
            Baixar mesmo assim
          </Button>
        </div>
      </div>
    </div>
  );
}
