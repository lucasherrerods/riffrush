import { TelaDoMania } from "@/modules/mania";
import { AppDoRock } from "./AppDoRock";
import { useModo } from "./modo";

/** Cada modo é um jogo à parte: o App só escolhe qual montar. */
export function App() {
  const modo = useModo();
  return modo === "mania" ? <TelaDoMania /> : <AppDoRock />;
}
