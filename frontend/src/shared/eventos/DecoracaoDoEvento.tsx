import type { CSSProperties } from "react";
import type { Evento } from "./calendario";

const FLOCOS = 36;
/** As luzes alternam entre as cores do tema do evento. */
const CORES_DAS_LUZES = ["var(--cor-primaria)", "var(--cor-destaque)", "var(--cor-sucesso)", "var(--cor-estrela)"];

/** Número pseudoaleatório fixo por índice: a neve fica igual a cada render, sem pular. */
const sorteio = (i: number, semente: number) => {
  const x = Math.sin(i * 12.9898 + semente * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Um fio de luzes que cai em curva entre duas pontas, como varal pendurado. `vertical` desce pela lateral. */
function Varal({ luzes, vertical, espelhado, classe, deslocamento = 0 }: { luzes: number; vertical?: boolean; espelhado?: boolean; classe: string; deslocamento?: number }) {
  return (
    <div data-varal className={`absolute flex justify-between ${vertical ? "flex-col" : ""} ${classe}`}>
      {Array.from({ length: luzes }, (_, i) => {
        // A barriga do varal: as luzes do meio caem mais que as das pontas.
        const barriga = Math.sin((i / (luzes - 1)) * Math.PI) * (espelhado ? -18 : 18);
        const estilo: CSSProperties = {
          background: CORES_DAS_LUZES[(i + deslocamento) % CORES_DAS_LUZES.length],
          transform: vertical ? `translateX(${barriga}px)` : `translateY(${barriga}px)`,
          animationDelay: `${((i + deslocamento) % 4) * 0.5}s`,
        };
        return <span key={i} data-luz className="evento-luz size-2.5 rounded-full" style={estilo} />;
      })}
    </div>
  );
}

function Natal() {
  return (
    <>
      {Array.from({ length: FLOCOS }, (_, i) => {
        const tamanho = 2 + sorteio(i, 1) * 4;
        const estilo: CSSProperties = {
          left: `${sorteio(i, 2) * 100}%`,
          width: tamanho,
          height: tamanho,
          opacity: 0.35 + sorteio(i, 3) * 0.5,
          animationDuration: `${9 + sorteio(i, 4) * 12}s`,
          animationDelay: `-${sorteio(i, 5) * 20}s`,
        };
        return <span key={i} data-floco className="evento-floco absolute -top-2 rounded-full bg-[var(--cor-texto)]" style={estilo} />;
      })}
      <Varal luzes={24} classe="inset-x-2 top-1" />
      {/* Dois varais em cada lateral, caindo dos cantos de cima, para encher os cantos vazios do menu. */}
      <Varal luzes={14} vertical classe="left-2 top-10 bottom-10" deslocamento={1} />
      <Varal luzes={10} vertical classe="left-14 top-10 h-1/2 max-sm:hidden" deslocamento={2} />
      <Varal luzes={14} vertical classe="right-2 top-10 bottom-10 items-end" espelhado deslocamento={3} />
      <Varal luzes={10} vertical classe="right-14 top-10 h-1/2 items-end max-sm:hidden" espelhado deslocamento={0} />
      <Varal luzes={12} classe="bottom-12 left-6 w-1/4 max-sm:hidden" deslocamento={2} />
      <Varal luzes={12} classe="bottom-12 right-6 w-1/4 max-sm:hidden" deslocamento={1} />
    </>
  );
}

const DECORACOES: Record<Evento["id"], () => React.JSX.Element> = { natal: Natal };

/** Enfeites do evento por cima da tela, só visuais: não recebem cliques nem aparecem para leitores de tela. */
export function DecoracaoDoEvento({ evento }: { evento?: Evento }) {
  if (!evento) return null;
  const Decoracao = DECORACOES[evento.id];
  return (
    <div aria-hidden="true" data-evento={evento.id} className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <Decoracao />
    </div>
  );
}
