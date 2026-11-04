import type { ReactNode } from "react";
import { Play, Search, Settings2 } from "lucide-react";
import { LogoDoJogo, TelaInicial, type TrocaDeModo } from "@/modules/menu";
import { TeclaDoMania } from "./TeclaDoMania";

interface Props {
  aoJogar: () => void;
  aoBuscar: () => void;
  aoConfigurar: () => void;
  /** A alavanca que volta para o Rock, embaixo da logo. */
  alavanca?: ReactNode;
  troca?: TrocaDeModo;
  aoMedirTitulo?: (retangulo: DOMRect) => void;
}

/** A tela inicial do Mania: a mesma do Rock, com as opções em teclas do mania. */
export function MenuDoMania({ aoJogar, aoBuscar, aoConfigurar, alavanca, troca, aoMedirTitulo }: Props) {
  return (
    <TelaInicial
      logo={<LogoDoJogo modo="Mania" fofa />}
      subtitulo="SIGA O RITMO"
      alavanca={alavanca}
      troca={troca}
      aoMedirTitulo={aoMedirTitulo}
      rotuloDoMenu="Menu do Mania"
      opcoes={[
        { rotulo: "Jogar", icone: Play, acao: aoJogar },
        { rotulo: "Buscar mapas", icone: Search, acao: aoBuscar },
        { rotulo: "Configurações", icone: Settings2, acao: aoConfigurar },
      ]}
      classeDoMenu="w-60 gap-1.5"
      classeDaOpcao={(ativa) => (ativa ? "border-primaria bg-primaria px-2 py-1.5 text-texto" : "border-borda bg-superficie-elevada px-2 py-1.5 text-texto-suave")}
      desenharIcone={(opcao, ativa) => <TeclaDoMania icone={opcao.icone} apagado={!ativa} />}
    />
  );
}
