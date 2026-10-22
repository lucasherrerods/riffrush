import { Slider } from "@/shared/ui/slider";
import { LinhaDeOpcao } from "./LinhaDeOpcao";

interface Props {
  rotulo: string;
  dica?: string;
  valor: number;
  minimo: number;
  maximo: number;
  passo: number;
  formatar: (valor: number) => string;
  aoMudar: (valor: number) => void;
}

export function LinhaDeSlider({ rotulo, dica, valor, minimo, maximo, passo, formatar, aoMudar }: Props) {
  return (
    <LinhaDeOpcao rotulo={rotulo} dica={dica}>
      <Slider
        aria-label={rotulo}
        className="w-56"
        value={[valor]}
        min={minimo}
        max={maximo}
        step={passo}
        onValueChange={([novo]) => aoMudar(novo)}
      />
      <span className="w-16 text-right font-mono text-base tabular-nums">{formatar(valor)}</span>
    </LinhaDeOpcao>
  );
}
