import { Columns2, Globe, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";

interface Props {
  aberta: boolean;
  aoFechar: () => void;
  aoLocal: () => void;
  aoOnline: () => void;
}

/** Ao abrir o Multiplayer no computador: jogar junto na mesma tela ou numa sala pela internet. */
export function EscolhaDoMultiplayer({ aberta, aoFechar, aoLocal, aoOnline }: Props) {
  return (
    <Dialog open={aberta} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-w-xl">
        <DialogTitle>Multiplayer</DialogTitle>
        <DialogDescription>Como vocês vão jogar?</DialogDescription>
        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1 max-md:gap-2">
          <Opcao icone={Columns2} titulo="Local" detalhe="Até 4 pistas na mesma tela, cada um com o seu controle." aoEscolher={aoLocal} />
          <Opcao icone={Globe} titulo="Online" detalhe="Crie uma sala ou entre na de um amigo pela internet." aoEscolher={aoOnline} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Opcao({ icone: Icone, titulo, detalhe, aoEscolher }: { icone: LucideIcon; titulo: string; detalhe: string; aoEscolher: () => void }) {
  return (
    <button
      onClick={aoEscolher}
      className="chapa group flex flex-col items-start gap-2 bg-superficie-elevada p-4 text-left transition-colors outline-none hover:border-primaria focus-visible:border-primaria max-md:flex-row max-md:items-center max-md:gap-4"
    >
      <Icone className="size-8 text-primaria opacity-70 transition-opacity group-hover:opacity-100 max-md:size-6 max-md:shrink-0" aria-hidden />
      <span className="flex flex-col gap-1">
        <span className="font-titulo text-2xl leading-none tracking-wide uppercase">{titulo}</span>
        <span className="text-base text-texto-suave">{detalhe}</span>
      </span>
    </button>
  );
}
