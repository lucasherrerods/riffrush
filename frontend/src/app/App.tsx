import { useEffect } from "react";
import { IDENTIDADE_DO_MANIA, TelaDoMania } from "@/modules/mania";
import { IDENTIDADE_DO_ROCK } from "@/modules/rock";
import { definirTema } from "@/shared/styles/tema";
import { TEMAS } from "@/shared/styles/tokens";
import { AppDoRock } from "./AppDoRock";
import { trocarModo, useModo } from "./modo";

const IDENTIDADES = { rock: IDENTIDADE_DO_ROCK, mania: IDENTIDADE_DO_MANIA };

/** Cada modo é um jogo à parte: o App só escolhe qual montar e veste a interface com o tema dele. */
export function App() {
  const modo = useModo();
  const identidade = IDENTIDADES[modo];
  useEffect(() => {
    definirTema(TEMAS[identidade.tema]);
    document.title = identidade.nome;
  }, [identidade]);
  return modo === "mania" ? <TelaDoMania aoTrocarDeModo={() => trocarModo("rock")} /> : <AppDoRock />;
}
