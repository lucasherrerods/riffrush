import { cn } from "@/shared/lib/utils";
import { CACAPAS_PRONTAS, type FormatoDaCacapa, type SkinDaCacapa } from "./cacapas";
import { CartaoDeSkin, GRADE_DE_SKINS } from "./CartaoDeSkin";

interface Props {
  escolhida: string;
  aoEscolher: (id: string) => void;
}

const FORMA: Record<FormatoDaCacapa, string> = {
  redonda: "rounded-full",
  retangular: "rounded-sm",
  hexagonal: "[clip-path:polygon(0_50%,25%_0,75%_0,100%_50%,75%_100%,25%_100%)]",
};

/** As cinco caçapas no formato e nas cores da skin. */
function Amostra({ cacapa }: { cacapa: SkinDaCacapa }) {
  return (
    <div aria-hidden data-formato={cacapa.formato} className="flex h-24 w-full items-center justify-center gap-1.5 rounded-md bg-fundo">
      {cacapa.cores.trastes.map((cor, i) => (
        <span key={i} className={cn("h-4 w-6", FORMA[cacapa.formato])} style={{ backgroundColor: cor }} />
      ))}
    </div>
  );
}

export function EscolhaDeCacapa({ escolhida, aoEscolher }: Props) {
  return (
    <div role="radiogroup" aria-label="Caçapas" className={cn(GRADE_DE_SKINS, "p-2")}>
      {CACAPAS_PRONTAS.map((cacapa) => (
        <CartaoDeSkin key={cacapa.id} nome={cacapa.nome} marcada={cacapa.id === escolhida} aoEscolher={() => aoEscolher(cacapa.id)} amostra={<Amostra cacapa={cacapa} />} />
      ))}
    </div>
  );
}
