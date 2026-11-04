import { useId, type CSSProperties } from "react";
import { cn } from "@/shared/lib/utils";

const COLUNAS = 7;

/** Notas caindo em cada coluna: coluna, atraso (s) e, nas notas longas, a altura em px. */
const NOTAS = [
  { coluna: 0, atraso: 0 },
  { coluna: 3, atraso: 0.4, longa: 140 },
  { coluna: 5, atraso: 0.8 },
  { coluna: 1, atraso: 1.2 },
  { coluna: 6, atraso: 1.5 },
  { coluna: 2, atraso: 1.9 },
  { coluna: 4, atraso: 2.3, longa: 200 },
  { coluna: 0, atraso: 2.7 },
  { coluna: 6, atraso: 3.1, longa: 110 },
  { coluna: 2, atraso: 3.4 },
  { coluna: 5, atraso: 3.8 },
  { coluna: 1, atraso: 4.2, longa: 160 },
];
const QUEDA_S = 3.6;

/** Claves flutuando dos dois lados: tipo, posição, tamanho, cor e atraso da flutuação. */
const CLAVES = [
  { tipo: "sol", lado: "left-[6%]", topo: "14%", tamanho: 120, rosa: true, atraso: 0, giro: -12 },
  { tipo: "fa", lado: "left-[16%]", topo: "52%", tamanho: 80, rosa: false, atraso: 1.6, giro: 8 },
  { tipo: "sol", lado: "left-[4%]", topo: "72%", tamanho: 70, rosa: false, atraso: 3.1, giro: 14 },
  { tipo: "sol", lado: "right-[7%]", topo: "20%", tamanho: 104, rosa: false, atraso: 0.8, giro: 10 },
  { tipo: "fa", lado: "right-[15%]", topo: "60%", tamanho: 96, rosa: true, atraso: 2.4, giro: -8 },
  { tipo: "sol", lado: "right-[4%]", topo: "78%", tamanho: 64, rosa: true, atraso: 3.8, giro: -16 },
] as const;

/**
 * Clave de sol em traço caligráfico: a haste e a laçada do alto finas, o bojo grosso
 * em espiral em volta da linha do sol e a bolinha na ponta de baixo.
 */
const SOL_FINO = "M21 141 C28 153 41 148 38 134 L32 32 C31 14 40 1 45 7 C51 17 38 34 24 46";
const SOL_GROSSO = "M24 46 C11 59 7 77 12 93 C17 109 37 114 47 100 C55 88 45 72 32 74 C22 76 20 90 30 94";
/** Clave de fá: o arco em meia-lua, que afina até a ponta, com a cabeça cheia e os dois pontos. */
const FA_ARCO = "M5 32 C5 10 47 8 47 35 C47 62 25 83 6 91 C22 78 39 60 39 35 C39 17 17 16 15 29 Z";

/** Um pedaço de pauta inclinado atrás da clave, com algumas notas soltas. */
function Pauta({ x, y, largura, giro, notas }: { x: number; y: number; largura: number; giro: number; notas: [number, number][] }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${giro})`} className="stroke-current" opacity={0.55}>
      {[0, 1, 2, 3, 4].map((linha) => (
        <line key={linha} x1={0} x2={largura} y1={linha * 5} y2={linha * 5} strokeWidth={0.8} />
      ))}
      {notas.map(([nx, linha]) => (
        <g key={nx} className="fill-current">
          <ellipse cx={nx} cy={linha * 2.5} rx={3.2} ry={2.3} transform={`rotate(-20 ${nx} ${linha * 2.5})`} className="stroke-none" />
          <line x1={nx + 2.9} x2={nx + 2.9} y1={linha * 2.5} y2={linha * 2.5 - 13} strokeWidth={1} />
        </g>
      ))}
    </g>
  );
}

/**
 * As claves em fita metálica: um traço largo com degradê de brilho (ouro ou rosa),
 * contorno escuro para dar volume e um filete claro de reflexo, sobre pedaços de pauta.
 */
function Clave({ tipo, rosa }: { tipo: "sol" | "fa"; rosa: boolean }) {
  const id = useId();
  const cor = rosa ? "var(--cor-primaria)" : "var(--cor-ouro)";
  const degrade = (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={{ stopColor: cor }} />
        <stop offset="0.35" style={{ stopColor: "var(--cor-texto)" }} />
        <stop offset="0.55" style={{ stopColor: cor }} />
        <stop offset="0.8" style={{ stopColor: "var(--cor-texto)", stopOpacity: 0.7 }} />
        <stop offset="1" style={{ stopColor: cor }} />
      </linearGradient>
    </defs>
  );
  if (tipo === "sol")
    return (
      <svg viewBox="0 0 120 170" className="size-full fill-none text-texto" strokeLinecap="round" strokeLinejoin="round">
        {degrade}
        <Pauta x={4} y={46} largura={112} giro={-14} notas={[[14, 3], [92, 1], [104, 6]]} />
        <Pauta x={10} y={120} largura={100} giro={10} notas={[[86, 2], [98, 5]]} />
        <g transform="translate(26 4)">
          <path d={SOL_FINO + " " + SOL_GROSSO} strokeWidth={10} style={{ stroke: "var(--cor-fundo)" }} opacity={0.7} />
          <path d={SOL_FINO + " " + SOL_GROSSO} strokeWidth={7.5} stroke={`url(#${id})`} />
          <path d={SOL_FINO + " " + SOL_GROSSO} strokeWidth={1.6} className="stroke-texto" opacity={0.75} />
          <circle cx="21" cy="139" r="9" fill={`url(#${id})`} style={{ stroke: "var(--cor-fundo)" }} strokeWidth={1.5} />
          <circle cx="19" cy="137" r="3" className="fill-texto" opacity={0.6} />
        </g>
      </svg>
    );
  return (
    <svg viewBox="0 0 120 110" className="size-full text-texto">
      {degrade}
      <Pauta x={2} y={30} largura={116} giro={-8} notas={[[100, 2], [110, 6]]} />
      <g transform="translate(24 8)">
        <path d={FA_ARCO} fill={`url(#${id})`} style={{ stroke: "var(--cor-fundo)" }} strokeWidth={1.5} />
        <circle cx="11" cy="31" r="8.5" fill={`url(#${id})`} style={{ stroke: "var(--cor-fundo)" }} strokeWidth={1.5} />
        <circle cx="9" cy="29" r="2.8" className="fill-texto" opacity={0.6} />
        <circle cx="56" cy="24" r="4.2" fill={`url(#${id})`} />
        <circle cx="56" cy="46" r="4.2" fill={`url(#${id})`} />
      </g>
    </svg>
  );
}

/** A coluna do meio é dourada, como o centro dos mapas ímpares no mania. */
const MEIO = (COLUNAS - 1) / 2;

/** Rosa nas colunas das bordas e alternando para o meio, branco nas outras, como as skins do mania. */
const notaRosa = (coluna: number) => Math.min(coluna, COLUNAS - 1 - coluna) % 2 === 0;

/**
 * O palco do Mania: o campo de 7 colunas atrás do menu, com notas e notas longas caindo
 * até a linha de julgamento, com os receptores acendendo embaixo no ritmo.
 * Tudo em rosa e branco sobre o roxo uva, do tema.
 */
export function FundoDoMania() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden bg-fundo">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--cor-primaria)_16%,transparent),transparent_60%)]" />

      {CLAVES.map((c) => (
        <div
          key={`${c.lado}-${c.topo}`}
          data-parte="clave"
          className={cn("clave-flutua absolute opacity-60 max-md:hidden", c.lado)}
          style={{ top: c.topo, width: c.tamanho * (c.tipo === "sol" ? 0.95 : 1.3), height: c.tamanho * (c.tipo === "sol" ? 1.35 : 1.2), animationDelay: `${-c.atraso}s`, "--giro": `${c.giro}deg` } as CSSProperties}
        >
          <Clave tipo={c.tipo} rosa={c.rosa} />
        </div>
      ))}

      {/* O campo de colunas, do alto até a linha de julgamento. */}
      <div className="absolute top-0 bottom-[14%] left-1/2 flex w-[480px] opacity-30 -translate-x-1/2 border-x border-borda bg-superficie/60 max-md:w-[84vw]">
        {Array.from({ length: COLUNAS }, (_, coluna) => (
          <div key={coluna} data-parte="coluna" className={cn("relative h-full flex-1 overflow-hidden border-r border-borda/60 last:border-r-0", coluna % 2 === 1 && "bg-superficie-elevada/40")}>
            {NOTAS.filter((n) => n.coluna === coluna).map((n) => (
              <span
                key={n.atraso}
                data-parte={n.longa ? "nota-longa" : "nota"}
                className={cn("nota-cai absolute inset-x-1.5 rounded-sm", coluna === MEIO ? "bg-ouro" : notaRosa(coluna) ? "bg-primaria" : "bg-texto", n.longa && "opacity-80")}
                style={{ height: n.longa ?? 18, animationDelay: `${n.atraso - QUEDA_S}s`, animationDuration: `${QUEDA_S}s` } as CSSProperties}
              />
            ))}
          </div>
        ))}
      </div>

      {/* A linha de julgamento e, embaixo dela, os receptores de cada coluna. */}
      <div className="absolute bottom-0 left-1/2 flex h-[14%] w-[480px] -translate-x-1/2 flex-col max-md:w-[84vw]">
        <div data-parte="julgamento" className="h-1 bg-primaria" />
        <div className="flex flex-1 gap-1.5 border-x border-borda bg-superficie/50 px-1.5 pt-2">
          {Array.from({ length: COLUNAS }, (_, coluna) => (
            <span
              key={coluna}
              data-parte="receptor"
              className={cn("receptor-acende h-full flex-1 rounded-t-sm border-t-4", coluna === MEIO ? "border-ouro bg-ouro/25" : notaRosa(coluna) ? "border-primaria bg-primaria/25" : "border-texto bg-texto/15")}
              style={{ animationDelay: `${(coluna * 0.63) % QUEDA_S}s` }}
            />
          ))}
        </div>
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,color-mix(in_srgb,var(--cor-fundo)_75%,transparent))]" />
    </div>
  );
}
