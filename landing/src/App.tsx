import { Abertura } from "./sections/Abertura";
import { Banda } from "./sections/Banda";
import { ComoJogar } from "./sections/ComoJogar";
import { Equipe } from "./sections/Equipe";
import { Final } from "./sections/Final";
import { Manifesto } from "./sections/Manifesto";
import { Recursos } from "./sections/Recursos";
import { Topo } from "./sections/Topo";

export function App() {
  return (
    <>
      <Topo />
      <main>
        <Abertura />
        <Manifesto />
        <Banda />
        <Recursos />
        <ComoJogar />
        <Equipe />
        <Final />
      </main>
    </>
  );
}
