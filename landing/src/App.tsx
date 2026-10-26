import { Abertura } from "./sections/Abertura";
import { Banda } from "./sections/Banda";
import { ComoJogar } from "./sections/ComoJogar";
import { Faixa } from "./sections/Faixa";
import { Final } from "./sections/Final";
import { Recursos } from "./sections/Recursos";
import { Topo } from "./sections/Topo";

export function App() {
  return (
    <>
      <Topo />
      <main>
        <Abertura />
        <Faixa />
        <Recursos />
        <Banda />
        <ComoJogar />
        <Final />
      </main>
    </>
  );
}
