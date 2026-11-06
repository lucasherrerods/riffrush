import { cn } from "@/shared/lib/utils";
import { Slider } from "@/shared/ui/slider";
import { Switch } from "@/shared/ui/switch";
import type { CoresDaCacapa } from "@/shared/styles/tokens";
import { ESQUEMAS_DE_CORES, FORMATOS_DA_CACAPA, esquemaPorId, type FormatoDaCacapa } from "./cacapas";
import { CartaoDeSkin, GRADE_DE_SKINS } from "./CartaoDeSkin";

export interface EscolhasDaCacapa {
  formatoDaCacapa: FormatoDaCacapa;
  coresDaCacapa: string;
  brilhoDaCacapa: number;
  contornoForte: boolean;
}

interface Props extends EscolhasDaCacapa {
  aoMudar: (parcial: Partial<EscolhasDaCacapa>) => void;
}

const FORMA: Record<FormatoDaCacapa, string> = {
  redonda: "h-5 w-7 rounded-full",
  retangular: "h-5 w-7 rounded-sm",
  hexagonal: "h-5 w-8 [clip-path:polygon(0_50%,25%_0,75%_0,100%_50%,75%_100%,25%_100%)]",
};

/** As cinco caçapas num formato e num esquema de cores. */
function Amostra({ formato, cores }: { formato: FormatoDaCacapa; cores: CoresDaCacapa }) {
  return (
    <div aria-hidden data-formato={formato} className="flex h-24 w-full items-center justify-center gap-1.5 rounded-md bg-fundo">
      {cores.trastes.map((cor, i) => (
        <span key={i} className={FORMA[formato]} style={{ backgroundColor: cor }} />
      ))}
    </div>
  );
}

export function EscolhaDoFormato({ formatoDaCacapa, coresDaCacapa, aoMudar }: Props) {
  const { cores } = esquemaPorId(coresDaCacapa);
  return (
    <div role="radiogroup" aria-label="Formato das caçapas" className={cn(GRADE_DE_SKINS, "p-2")}>
      {FORMATOS_DA_CACAPA.map(({ id, nome }) => (
        <CartaoDeSkin key={id} nome={nome} marcada={id === formatoDaCacapa} aoEscolher={() => aoMudar({ formatoDaCacapa: id })} amostra={<Amostra formato={id} cores={cores} />} />
      ))}
    </div>
  );
}

export function EscolhaDasCores({ formatoDaCacapa, coresDaCacapa, brilhoDaCacapa, contornoForte, aoMudar }: Props) {
  return (
    <div className="flex flex-col gap-4 p-2">
      <div role="radiogroup" aria-label="Cores das caçapas" className={GRADE_DE_SKINS}>
        {ESQUEMAS_DE_CORES.map((esquema) => (
          <CartaoDeSkin
            key={esquema.id}
            nome={esquema.nome}
            marcada={esquema.id === coresDaCacapa}
            aoEscolher={() => aoMudar({ coresDaCacapa: esquema.id })}
            amostra={
              <div className="relative">
                <Amostra formato={formatoDaCacapa} cores={esquema.cores} />
                {esquema.acessivel && <span className="absolute top-1 left-1 rounded-sm bg-superficie-elevada px-1.5 text-xs font-semibold text-texto-suave">Daltonismo</span>}
              </div>
            }
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold">Brilho das notas</p>
          <p className="text-sm text-texto-suave">Abaixe se o brilho atrapalhar a leitura</p>
        </div>
        <div className="flex items-center gap-2">
          <Slider aria-label="Brilho das notas" className="w-48 max-md:w-24" value={[Math.round(brilhoDaCacapa * 100)]} min={0} max={100} step={5} onValueChange={([novo]) => aoMudar({ brilhoDaCacapa: novo / 100 })} />
          <span className="w-12 text-right font-mono tabular-nums">{Math.round(brilhoDaCacapa * 100)}%</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="contorno-forte">
          <p className="font-semibold">Contorno forte nas notas</p>
          <p className="text-sm text-texto-suave">Borda clara e grossa, para ver a nota sobre qualquer pista</p>
        </label>
        <Switch id="contorno-forte" aria-label="Contorno forte nas notas" checked={contornoForte} onCheckedChange={(ligado) => aoMudar({ contornoForte: ligado })} />
      </div>
    </div>
  );
}
