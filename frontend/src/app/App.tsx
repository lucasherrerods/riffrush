import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { tocarEfeito } from "@/modules/audio";
import { IDENTIDADE_DO_MANIA } from "@/modules/mania";
import { AlavancaDeModo, TransicaoDeModo, COBERTURA_DA_TRANSICAO_MS, DURACAO_DA_TRANSICAO_MS } from "@/modules/menu";
import { IDENTIDADE_DO_ROCK } from "@/modules/rock";
import { carregarConfiguracoes } from "@/modules/settings";
import { definirTema } from "@/shared/styles/tema";
import { TEMAS } from "@/shared/styles/tokens";
import { AppDoRock } from "./AppDoRock";
import { MANIA_LIGADO, trocarModo, useModo, type Modo } from "./modo";

const IDENTIDADES = { rock: IDENTIDADE_DO_ROCK, mania: IDENTIDADE_DO_MANIA };
const ROTULOS: Record<Modo, string> = { rock: "Rock", mania: "Mania" };

/** O menu é um só: o App veste a interface com o tema do modo e faz a transição entre eles. */
export function App({ maniaLigado = MANIA_LIGADO }: { maniaLigado?: boolean } = {}) {
  const modo = useModo();
  const semMovimento = useReducedMotion();
  const [destino, setDestino] = useState<Modo | null>(null);
  const identidade = IDENTIDADES[modo];
  useEffect(() => {
    definirTema(TEMAS[identidade.tema]);
    document.title = identidade.nome;
  }, [identidade]);

  // O modo só troca com a tela coberta, para o tema novo não aparecer antes da hora.
  useEffect(() => {
    if (!destino) return;
    const cobrir = setTimeout(() => trocarModo(destino), COBERTURA_DA_TRANSICAO_MS);
    const terminar = setTimeout(() => setDestino(null), DURACAO_DA_TRANSICAO_MS);
    return () => {
      clearTimeout(cobrir);
      clearTimeout(terminar);
    };
  }, [destino]);

  const girar = (para: Modo) => {
    if (destino) return;
    if (semMovimento) return trocarModo(para);
    tocarEfeito("selecionar", carregarConfiguracoes().volumeDosEfeitos);
    setDestino(para);
  };

  const alavanca = maniaLigado ? <AlavancaDeModo modo={destino ?? modo} aoTrocar={girar} /> : undefined;
  return (
    <>
      <AppDoRock modo={modo} alavanca={alavanca} />
      {destino && <TransicaoDeModo nome={ROTULOS[destino]} cores={TEMAS[IDENTIDADES[destino].tema].cores} />}
    </>
  );
}
