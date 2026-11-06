import type { ReactNode } from "react";
import { Play, Radio, Search, Settings2, Trophy } from "lucide-react";
import { LogoDoJogo, TelaInicial, type TrocaDeModo } from "@/modules/menu";
import { TeclaDoMania } from "./TeclaDoMania";

interface Props {
  aoJogar: () => void;
  aoBuscar: () => void;
  aoConfigurar: () => void;
  /** O leaderboard de XP e dos mapas; sem ele (contas desligadas), a opção não aparece. */
  aoLeaderboard?: () => void;
  /** Quem está online nos dois modos, para assistir; sem relay ou sem contas, a opção não aparece. */
  aoOnline?: () => void;
  /** O chat global, o mesmo do Rock. */
  chat?: ReactNode;
  /** A alavanca que volta para o Rock, embaixo da logo. */
  alavanca?: ReactNode;
  troca?: TrocaDeModo;
  /** Só a imagem da tela, para o disco da troca. */
  estatica?: boolean;
}

/** A tela inicial do Mania: a mesma do Rock, com as opções em teclas do mania. */
export function MenuDoMania({ aoJogar, aoBuscar, aoConfigurar, aoLeaderboard, aoOnline, chat, alavanca, troca, estatica }: Props) {
  return (
    <TelaInicial
      logo={<LogoDoJogo modo="Mania" fofa />}
      subtitulo="SIGA O RITMO"
      alavanca={alavanca}
      troca={troca}
      estatica={estatica}
      chat={chat}
      rotuloDoMenu="Menu do Mania"
      opcoes={[
        { rotulo: "Jogar", icone: Play, acao: aoJogar },
        { rotulo: "Buscar mapas", icone: Search, acao: aoBuscar },
        ...(aoLeaderboard ? [{ rotulo: "Leaderboard", icone: Trophy, acao: aoLeaderboard }] : []),
        ...(aoOnline ? [{ rotulo: "Online", icone: Radio, acao: aoOnline }] : []),
        { rotulo: "Configurações", icone: Settings2, acao: aoConfigurar },
      ]}
      classeDoMenu="w-60 gap-1.5"
      classeDaOpcao={(ativa) => (ativa ? "border-primaria bg-primaria px-2 py-1.5 text-texto" : "border-borda bg-superficie-elevada px-2 py-1.5 text-texto-suave")}
      desenharIcone={(opcao, ativa) => <TeclaDoMania icone={opcao.icone} apagado={!ativa} />}
    />
  );
}
