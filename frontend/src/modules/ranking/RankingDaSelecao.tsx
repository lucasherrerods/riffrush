import { useState, type ComponentProps } from "react";
import { JEITOS_DE_JOGAR, NOMES_DOS_JEITOS, type JeitoDeJogar } from "@/modules/rock/gameplay";
import { GrupoDeOpcoes } from "@/shared/ui/GrupoDeOpcoes";
import { PainelDeRanking } from "./PainelDeRanking";

export const OPCOES_DOS_JEITOS = JEITOS_DE_JOGAR.map((id) => ({ id, rotulo: NOMES_DOS_JEITOS[id] }));

interface Props extends Omit<ComponentProps<typeof PainelDeRanking>, "jeito"> {
  /** O jeito configurado pelo jogador. */
  jeitoInicial: JeitoDeJogar;
}

/** O ranking da música na seleção: abre no jeito de quem joga e deixa ver os outros. */
export function RankingDaSelecao({ jeitoInicial, ...painel }: Props) {
  const [jeito, setJeito] = useState(jeitoInicial);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <GrupoDeOpcoes titulo="Jeito de jogar" opcoes={OPCOES_DOS_JEITOS} valor={jeito} aoEscolher={setJeito} />
      <PainelDeRanking {...painel} jeito={jeito} />
    </div>
  );
}
