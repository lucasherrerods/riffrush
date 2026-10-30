import { Columns2, Globe, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";

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
      {/* O título e as duas opções já dizem tudo: sem descrição. */}
      <DialogContent aria-describedby={undefined} className="max-w-4xl gap-8 p-12 max-md:gap-4 max-md:p-6">
        <DialogTitle className="text-5xl max-md:text-3xl">Multiplayer</DialogTitle>
        <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1 max-md:gap-2">
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
      className="chapa group flex min-h-72 flex-col justify-end gap-4 bg-superficie-elevada p-8 text-left transition-colors outline-none hover:border-primaria focus-visible:border-primaria max-md:min-h-0 max-md:flex-row max-md:items-center max-md:justify-start max-md:gap-4 max-md:p-4"
    >
      <Icone className="mb-auto size-12 text-primaria opacity-70 transition-opacity group-hover:opacity-100 max-md:mb-0 max-md:size-6 max-md:shrink-0" aria-hidden />
      <span className="flex flex-col gap-2">
        <span className="font-titulo text-4xl leading-none tracking-wide uppercase max-md:text-2xl">{titulo}</span>
        <span className="text-base text-texto-suave">{detalhe}</span>
      </span>
    </button>
  );
}
