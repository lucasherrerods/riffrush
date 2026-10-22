import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cores } from "@/shared/styles/tokens";
import type { Personagem } from "./personagem";

interface Props {
  personagem: Personagem;
  className?: string;
  /** Anima tocando no ritmo da música. */
  tocando?: boolean;
  bpm?: number;
  /** Muda a cada nota acertada e dispara uma palhetada. */
  pulso?: number;
  /** Vida baixa deixa o chibi triste. */
  triste?: boolean;
}

const CONTORNO = "#1a1020";
const QUASE_BRANCO = cores.texto;

function escurecer(hex: string, quanto: number) {
  const n = parseInt(hex.slice(1), 16);
  const canal = (v: number) => Math.min(255, Math.max(0, Math.round(v * (1 - quanto))));
  return `rgb(${canal((n >> 16) & 255)},${canal((n >> 8) & 255)},${canal(n & 255)})`;
}

const contorno = { stroke: CONTORNO, strokeWidth: 2, strokeLinejoin: "round" as const };

function CabeloDeTras({ p }: { p: Personagem }) {
  switch (p.cabelo) {
    case "chanel":
      return <path d="M22 50 Q22 14 60 14 Q98 14 98 50 L98 82 Q86 88 78 80 L42 80 Q34 88 22 82 Z" fill={p.corDoCabelo} {...contorno} />;
    case "longo":
      return <path d="M22 50 Q22 12 60 12 Q98 12 98 50 L100 100 Q90 96 84 102 L36 102 Q30 96 20 100 Z" fill={p.corDoCabelo} {...contorno} />;
    case "coquinhos":
      return (
        <>
          <circle cx="28" cy="24" r="13" fill={p.corDoCabelo} {...contorno} />
          <circle cx="92" cy="24" r="13" fill={p.corDoCabelo} {...contorno} />
        </>
      );
    default:
      return null;
  }
}

function CabeloDaFrente({ p }: { p: Personagem }) {
  switch (p.cabelo) {
    case "espetado":
      return (
        <path
          d="M24 52 L18 30 L32 34 L30 12 L46 26 L52 6 L62 24 L74 6 L78 26 L94 12 L90 34 L104 30 L96 52 Q86 34 60 34 Q34 34 24 52 Z"
          fill={p.corDoCabelo}
          {...contorno}
        />
      );
    case "moicano":
      return (
        <>
          <path d="M26 48 Q28 24 60 22 Q92 24 94 48 Q80 36 60 36 Q40 36 26 48 Z" fill={escurecer(p.corDoCabelo, 0.35)} {...contorno} />
          <path d="M50 30 L46 2 L56 14 L60 -2 L64 14 L74 2 L70 30 Z" fill={p.corDoCabelo} {...contorno} />
        </>
      );
    default:
      return <path d="M24 50 Q26 16 60 16 Q94 16 96 50 Q88 34 74 38 Q66 28 56 36 Q40 28 24 50 Z" fill={p.corDoCabelo} {...contorno} />;
  }
}

function OlhosDoChibi({ p, triste }: { p: Personagem; triste: boolean }) {
  if (triste) {
    return (
      <g data-parte="olhos-tristes" stroke={CONTORNO} strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M41 58 L53 56" />
        <path d="M67 56 L79 58" />
      </g>
    );
  }
  switch (p.olhos) {
    case "feliz":
      return (
        <g stroke={CONTORNO} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M41 59 Q47 51 53 59" />
          <path d="M67 59 Q73 51 79 59" />
        </g>
      );
    case "marrento":
      return (
        <g stroke={CONTORNO} strokeWidth="3.5" strokeLinecap="round">
          <path d="M40 57 L54 57" />
          <path d="M66 57 L80 57" />
        </g>
      );
    case "estrela":
      return (
        <g fill="#facc15" stroke={CONTORNO} strokeWidth="1.5" strokeLinejoin="round">
          {[47, 73].map((x) => (
            <path
              key={x}
              d={`M${x} 49 L${x + 2.5} 54.5 L${x + 8} 55 L${x + 4} 58.5 L${x + 5} 64 L${x} 61 L${x - 5} 64 L${x - 4} 58.5 L${x - 8} 55 L${x - 2.5} 54.5 Z`}
            />
          ))}
        </g>
      );
    default:
      return (
        <g>
          {[47, 73].map((x) => (
            <g key={x}>
              <ellipse cx={x} cy="57" rx="5" ry="6.5" fill={CONTORNO} />
              <circle cx={x + 1.8} cy="54.5" r="2" fill={QUASE_BRANCO} />
            </g>
          ))}
        </g>
      );
  }
}

function AcessorioDoChibi({ p }: { p: Personagem }) {
  switch (p.acessorio) {
    case "oculos":
      return (
        <g data-parte="acessorio-oculos" fill="#141218" stroke={CONTORNO} strokeWidth="1.5">
          <rect x="37" y="51" width="20" height="11" rx="4" />
          <rect x="63" y="51" width="20" height="11" rx="4" />
          <path d="M57 55 L63 55" stroke="#141218" strokeWidth="3" />
          <path d="M40 54 L46 54" stroke={QUASE_BRANCO} strokeOpacity="0.5" strokeWidth="2" />
        </g>
      );
    case "fone":
      return (
        <g data-parte="acessorio-fone" stroke={CONTORNO} strokeWidth="2">
          <path d="M22 54 Q22 10 60 10 Q98 10 98 54" fill="none" stroke="#27272a" strokeWidth="6" />
          <rect x="14" y="46" width="12" height="20" rx="5" fill="#ef4444" />
          <rect x="94" y="46" width="12" height="20" rx="5" fill="#ef4444" />
        </g>
      );
    case "bandana":
      return (
        <g data-parte="acessorio-bandana" stroke={CONTORNO} strokeWidth="2">
          <path d="M25 40 Q60 26 95 40 L94 47 Q60 34 26 47 Z" fill="#dc2626" />
          <path d="M94 42 L106 36 L104 48 Z" fill="#dc2626" />
          {[
            [44, 40],
            [62, 36],
            [80, 39],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="1.5" fill={QUASE_BRANCO} stroke="none" />
          ))}
        </g>
      );
    case "coroa":
      return <path data-parte="acessorio-coroa" d="M40 22 L44 4 L52 16 L60 0 L68 16 L76 4 L80 22 Z" fill="#facc15" {...contorno} />;
    default:
      return null;
  }
}

/** O instrumento e os braços que tocam ele. Cada `pulso` novo reinicia a palhetada. */
function InstrumentoEBracos({ p, pulso }: { p: Personagem; pulso: number }) {
  const braco = (caminho: string) => (
    <>
      <path d={caminho} stroke={CONTORNO} strokeWidth="10" strokeLinecap="round" fill="none" />
      <path d={caminho} stroke={p.pele} strokeWidth="6.5" strokeLinecap="round" fill="none" />
    </>
  );
  // A key leva a origem: na bateria são dois braços batendo ao mesmo tempo.
  const palhetada = (conteudo: ReactNode, origem: string) => (
    <motion.g
      key={`${origem}-${pulso}`}
      initial={{ rotate: -22 }}
      animate={{ rotate: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 14 }}
      style={{ transformOrigin: origem }}
    >
      {conteudo}
    </motion.g>
  );

  switch (p.instrumento) {
    case "bateria":
      return (
        <g data-parte="instrumento-bateria">
          <path d="M100 98 L108 140" stroke="#a1a1aa" strokeWidth="2" />
          <ellipse cx="100" cy="98" rx="14" ry="3.5" fill="#facc15" stroke={CONTORNO} strokeWidth="1.5" />
          <rect x="34" y="118" width="52" height="22" rx="4" fill="#e11d48" stroke={CONTORNO} strokeWidth="2" />
          <ellipse cx="60" cy="118" rx="26" ry="6" fill={QUASE_BRANCO} stroke={CONTORNO} strokeWidth="2" />
          {palhetada(
            <>
              {braco("M44 92 L38 108")}
              <path d="M38 108 L58 116" stroke="#d6a76c" strokeWidth="3" strokeLinecap="round" />
            </>,
            "44px 92px",
          )}
          {palhetada(
            <>
              {braco("M76 92 L84 104")}
              <path d="M84 104 L96 96" stroke="#d6a76c" strokeWidth="3" strokeLinecap="round" />
            </>,
            "76px 92px",
          )}
        </g>
      );
    case "keytar":
      return (
        <g data-parte="instrumento-keytar">
          <g transform="rotate(-14 60 106)">
            <rect x="26" y="98" width="70" height="17" rx="5" fill={escurecer(p.roupa, -0.2)} stroke={CONTORNO} strokeWidth="2" />
            <rect x="44" y="101" width="48" height="10" fill={QUASE_BRANCO} stroke={CONTORNO} strokeWidth="1" />
            {[50, 56, 62, 68, 74, 80, 86].map((x) => (
              <path key={x} d={`M${x} 101 L${x} 107`} stroke={CONTORNO} strokeWidth="2.5" />
            ))}
          </g>
          {braco("M44 92 L36 106")}
          {palhetada(braco("M76 92 L72 104"), "76px 92px")}
        </g>
      );
    case "vocal":
      return (
        <g data-parte="instrumento-vocal">
          <path d="M92 142 L84 96" stroke="#71717a" strokeWidth="3" />
          <path d="M84 96 L74 82" stroke="#71717a" strokeWidth="3" />
          <ellipse cx="72" cy="79" rx="5" ry="6" fill="#3f3f46" stroke={CONTORNO} strokeWidth="1.5" transform="rotate(-35 72 79)" />
          {braco("M44 92 L34 80")}
          {palhetada(braco("M76 92 L72 84"), "76px 92px")}
        </g>
      );
    default: {
      const baixo = p.instrumento === "baixo";
      const corpo = baixo ? "#0ea5e9" : "#ef4444";
      return (
        <g data-parte={`instrumento-${p.instrumento}`}>
          <g transform="rotate(-28 56 108)">
            <rect x="58" y="104" width={baixo ? 50 : 40} height="6" fill="#8b5a2b" stroke={CONTORNO} strokeWidth="1.5" />
            <rect x={baixo ? 106 : 96} y="101" width="9" height="12" rx="2" fill="#27272a" stroke={CONTORNO} strokeWidth="1.5" />
            <ellipse cx="44" cy="107" rx="15" ry="12" fill={corpo} stroke={CONTORNO} strokeWidth="2" />
            <ellipse cx="58" cy="107" rx="10" ry="9" fill={corpo} stroke={CONTORNO} strokeWidth="2" />
            <circle cx="50" cy="107" r="3.5" fill={CONTORNO} />
          </g>
          {braco("M76 92 L90 92")}
          {palhetada(braco("M44 92 L50 108"), "44px 92px")}
        </g>
      );
    }
  }
}

export function Chibi({ personagem: p, className, tocando = false, bpm = 120, pulso = 0, triste = false }: Props) {
  const batida = 60 / bpm;
  const balancoDaCabeca = {
    animate: tocando ? { rotate: [-4, 4, -4] } : { rotate: 0 },
    transition: { repeat: Infinity, duration: batida * 2, ease: "easeInOut" as const },
    style: { transformOrigin: "60px 84px" },
  };

  return (
    <svg viewBox="-4 -8 128 160" className={className} role="img" aria-label={`Personagem ${p.nome}`}>
      <ellipse cx="60" cy="146" rx="34" ry="5" fill={cores.fundo} opacity="0.5" />
      <motion.g
        animate={tocando ? { y: [0, -4, 0] } : { y: [0, -1.5, 0] }}
        transition={{ repeat: Infinity, duration: tocando ? batida : 2.4, ease: "easeInOut" }}
      >
        {/* O cabelo de trás vem antes do corpo para não cobri-lo. */}
        <motion.g data-parte="cabelo-de-tras" {...balancoDaCabeca}>
          <CabeloDeTras p={p} />
        </motion.g>

        <g data-parte="corpo">
          <rect x="44" y="118" width="11" height="20" rx="3" fill="#27272a" stroke={CONTORNO} strokeWidth="2" />
          <rect x="65" y="118" width="11" height="20" rx="3" fill="#27272a" stroke={CONTORNO} strokeWidth="2" />
          <path d="M40 140 Q40 134 50 134 L56 134 L56 143 L40 143 Z" fill={QUASE_BRANCO} stroke={CONTORNO} strokeWidth="2" />
          <path d="M64 134 L70 134 Q80 134 80 140 L80 143 L64 143 Z" fill={QUASE_BRANCO} stroke={CONTORNO} strokeWidth="2" />
          <path d="M40 92 Q40 84 50 84 L70 84 Q80 84 80 92 L82 122 L38 122 Z" fill={p.roupa} stroke={CONTORNO} strokeWidth="2" />
          <path d="M52 84 L60 94 L68 84" fill="none" stroke={escurecer(p.roupa, 0.4)} strokeWidth="2" />
        </g>

        <InstrumentoEBracos p={p} pulso={pulso} />

        <motion.g data-parte="cabeca" {...balancoDaCabeca}>
          <ellipse cx="60" cy="52" rx="36" ry="34" fill={p.pele} stroke={CONTORNO} strokeWidth="2.5" />
          <ellipse cx="41" cy="67" rx="6" ry="3.5" fill="#fb7185" opacity="0.5" />
          <ellipse cx="79" cy="67" rx="6" ry="3.5" fill="#fb7185" opacity="0.5" />
          <OlhosDoChibi p={p} triste={triste} />
          {triste ? (
            <path d="M54 73 Q60 68 66 73" stroke={CONTORNO} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          ) : tocando ? (
            <ellipse cx="60" cy="71" rx="4.5" ry="4" fill="#7f1d1d" stroke={CONTORNO} strokeWidth="1.5" />
          ) : (
            <path d="M54 69 Q60 75 66 69" stroke={CONTORNO} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          )}
          <CabeloDaFrente p={p} />
          <AcessorioDoChibi p={p} />
        </motion.g>
      </motion.g>
    </svg>
  );
}
