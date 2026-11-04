import { useState } from "react";
import type { OpcoesDoMania } from "../gameplay/TelaDeJogoMania";
import { carregarConfiguracoesDoMania, salvarConfiguracoesDoMania } from "./configuracoesMania";
import { JanelaDeConfiguracoesMania } from "./JanelaDeConfiguracoesMania";

/** As configurações do Mania abertas pelo menu principal: cada mudança já fica salva. */
export function ConfiguracoesDoMania({ aoFechar }: { aoFechar: () => void }) {
  const [opcoes, setOpcoes] = useState<OpcoesDoMania>(carregarConfiguracoesDoMania);
  const mudar = (novas: OpcoesDoMania) => {
    setOpcoes(novas);
    salvarConfiguracoesDoMania(novas);
  };
  return <JanelaDeConfiguracoesMania aberta aoFechar={aoFechar} opcoes={opcoes} aoMudar={mudar} />;
}
